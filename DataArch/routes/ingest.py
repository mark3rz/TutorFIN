"""
routes/ingest.py — Document ingestion and results endpoints.

Endpoints:
  POST /ingest                         Upload a document, get structured extraction
  GET  /results                        List all saved output files
  GET  /results/{id}                   Fetch a specific result by filename stem
  POST /pipeline/run                   One-click full pipeline (background job); accepts optional selected_sheets
  GET  /pipeline/status/{id}           Poll pipeline job status
  GET  /pipeline/jobs                  List recent pipeline jobs
  GET  /documents                      Document library — all uploads with status, entity count, date
  POST /ingest/excel/analyze           Pre-analyze an Excel file (sheet classification, no pipeline)
  GET  /ingest/template/{entity_type}  Download a .xlsx upload template for an entity type
  GET  /ingest/templates               List all available templates with column definitions
"""

from __future__ import annotations

import json
import shutil
import tempfile
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse, Response

import config
from auth import TokenUser, get_current_user
from pipeline.ingest import ingest
from pipeline.schema import ParsedDocument
from services.audit import get_client_ip, log_action

router = APIRouter(tags=["ingest"])

OUTPUTS_DIR = Path("outputs")
OUTPUTS_DIR.mkdir(exist_ok=True)

SUPPORTED_EXTENSIONS = {".pdf", ".xlsx", ".xlsm", ".csv", ".docx", ".eml"}
MAX_UPLOAD_SIZE = 25 * 1024 * 1024  # 25 MB

# Magic bytes for content-type validation
MAGIC_BYTES = {
    ".pdf": [b"%PDF"],
    ".xlsx": [b"PK\x03\x04"],
    ".xlsm": [b"PK\x03\x04"],
    ".docx": [b"PK\x03\x04"],
    ".csv": [],  # text, no magic bytes
    ".eml": [],  # text, no magic bytes
}


# ── Ingestion ──────────────────────────────────────────────────────────────

@router.post("/ingest", response_model=dict)
async def ingest_document(
    request: Request,
    file: UploadFile = File(...),
    user: TokenUser = Depends(get_current_user),
):
    """Upload a document (PDF, Excel, DOCX, CSV, EML). Returns structured extraction."""
    suffix = Path(file.filename).suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{suffix}'. Supported: {sorted(SUPPORTED_EXTENSIONS)}",
        )

    # Read file into memory for size and magic byte checks
    content = await file.read()

    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(content) / 1024 / 1024:.1f} MB). Maximum: {MAX_UPLOAD_SIZE / 1024 / 1024:.0f} MB.",
        )

    # Validate magic bytes for binary formats
    expected = MAGIC_BYTES.get(suffix, [])
    if expected and not any(content[:len(sig)] == sig for sig in expected):
        raise HTTPException(
            status_code=415,
            detail=f"File content does not match expected format for '{suffix}'.",
        )

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(content)
        tmp_path = Path(tmp.name)

    named_path = tmp_path.parent / file.filename
    tmp_path.rename(named_path)

    try:
        result: ParsedDocument = ingest(named_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if named_path.exists():
            named_path.unlink()

    log_action(
        user_id=user.id,
        action="ingest",
        resource_type="document",
        resource_id=file.filename,
        details={"size_bytes": len(content), "format": suffix},
        ip_address=get_client_ip(request),
    )

    return JSONResponse(content=result.to_output_dict())


# ── Results ────────────────────────────────────────────────────────────────

@router.get("/results")
def list_results(
    offset: int = 0,
    limit: int = 50,
    user: TokenUser = Depends(get_current_user),
):
    """List previously parsed document results, newest first."""
    files = sorted(OUTPUTS_DIR.glob("*.json"), key=lambda f: f.stat().st_mtime, reverse=True)
    total = len(files)
    page = files[offset : offset + limit]
    return {"total": total, "offset": offset, "limit": limit, "results": [f.stem for f in page]}


@router.get("/results/{document_id}")
def get_result(document_id: str, user: TokenUser = Depends(get_current_user)):
    """Fetch a specific parsed result by document name (without .json)."""
    path = OUTPUTS_DIR / f"{document_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Result '{document_id}' not found.")
    return JSONResponse(content=json.loads(path.read_text()))


# ── Pipeline Automation ────────────────────────────────────────────────────

@router.post("/pipeline/run")
async def pipeline_run(
    request: Request,
    file: UploadFile = File(...),
    company_id: Optional[int] = Form(None),
    selected_sheets: Optional[List[str]] = Form(None),
    user: TokenUser = Depends(get_current_user),
):
    """One-click pipeline: upload a document and run the full pipeline.

    Steps: ingest → ontology → schema → database create → data load → embed.
    Returns immediately with a job_id. Poll GET /pipeline/status/{job_id} for progress.

    Optional form fields:
        selected_sheets — list of sheet names to process (Excel only).
            If omitted or null, all sheets are processed.
            Send multiple form values: selected_sheets=Sheet1&selected_sheets=Sheet2
    """
    from pipeline.pipeline_runner import run_pipeline

    suffix = Path(file.filename).suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{suffix}'. Supported: {sorted(SUPPORTED_EXTENSIONS)}",
        )

    # Read and validate file size
    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(content) / 1024 / 1024:.1f} MB). Maximum: {MAX_UPLOAD_SIZE / 1024 / 1024:.0f} MB.",
        )

    # Validate magic bytes
    expected = MAGIC_BYTES.get(suffix, [])
    if expected and not any(content[:len(sig)] == sig for sig in expected):
        raise HTTPException(
            status_code=415,
            detail=f"File content does not match expected format for '{suffix}'.",
        )

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(content)
        tmp_path = Path(tmp.name)

    named_path = tmp_path.parent / file.filename
    if named_path.exists():
        named_path.unlink()
    tmp_path.rename(named_path)

    skip_embed = not config.VOYAGE_API_KEY

    # If user is company-scoped, enforce their company_id
    if not user.is_pe_admin and user.company_id:
        company_id = user.company_id

    job_id = run_pipeline(
        file_path=named_path,
        filename=file.filename,
        skip_embed=skip_embed,
        company_id=company_id,
        selected_sheets=selected_sheets or None,  # normalize empty list → None
    )

    log_action(
        user_id=user.id,
        action="pipeline_run",
        resource_type="document",
        resource_id=file.filename,
        details={
            "job_id": job_id,
            "company_id": company_id,
            "size_bytes": len(content),
            "selected_sheets": selected_sheets or None,
        },
        ip_address=get_client_ip(request),
    )

    return JSONResponse(content={
        "job_id": job_id,
        "filename": file.filename,
        "company_id": company_id,
        "status": "queued",
        "status_url": f"/pipeline/status/{job_id}",
    })


@router.get("/pipeline/status/{job_id}")
def pipeline_status(job_id: str, user: TokenUser = Depends(get_current_user)):
    """Poll the status of a pipeline job."""
    from pipeline.pipeline_runner import get_job

    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Pipeline job '{job_id}' not found.")
    return JSONResponse(content=job.to_dict())


@router.get("/pipeline/jobs")
def pipeline_jobs(
    offset: int = 0,
    limit: int = 20,
    user: TokenUser = Depends(get_current_user),
):
    """List recent pipeline jobs (newest first), with pagination."""
    from pipeline.pipeline_runner import list_jobs

    all_jobs = list_jobs(limit=500)  # fetch a generous pool then slice
    total = len(all_jobs)
    page = all_jobs[offset : offset + limit]
    return JSONResponse(content={"total": total, "offset": offset, "limit": limit, "jobs": page})


# ── Document Library ───────────────────────────────────────────────────────

@router.get("/documents")
def list_documents(
    company_id: Optional[int] = None,
    status: Optional[str] = None,
    offset: int = 0,
    limit: int = 50,
    user: TokenUser = Depends(get_current_user),
):
    """
    Document library — list all uploaded files with processing status,
    entity count extracted, upload timestamp, and duration.

    Sourced from the pipeline_jobs table (most reliable metadata source).

    Query params:
        company_id  — filter to a specific portfolio company
        status      — filter by job status (queued|running|completed|failed|partial)
        offset      — pagination offset (default 0)
        limit       — page size (default 50)
    """
    from services.job_store import load_recent_jobs

    # Enforce company scoping for non-PE admins
    if not user.is_pe_admin and user.company_id:
        company_id = user.company_id

    all_jobs = load_recent_jobs(limit=1000)

    documents = []
    for job in all_jobs:
        # Apply optional filters
        if company_id is not None and job.get("company_id") != company_id:
            continue
        if status and job.get("status") != status:
            continue

        # Extract entity count from the ingest step detail
        steps = job.get("steps") or {}
        ingest_detail = (steps.get("ingest") or {}).get("detail") or {}
        entity_count = ingest_detail.get("entities", 0)
        ingest_status = ingest_detail.get("status", "")

        # Resolve company name from company_id (best-effort)
        company_name = None
        cid = job.get("company_id")
        if cid:
            try:
                from pipeline.company import get_company
                co = get_company(cid)
                company_name = co.name if co else None
            except Exception:
                pass

        documents.append({
            "job_id": job["job_id"],
            "filename": job["filename"],
            "status": job["status"],
            "company_id": cid,
            "company_name": company_name,
            "entity_count": entity_count or 0,
            "extraction_status": ingest_status,
            "uploaded_at": job.get("created_at"),
            "completed_at": job.get("completed_at"),
            "duration_ms": job.get("duration_ms"),
            "error": job.get("error"),
        })

    total = len(documents)
    page = documents[offset : offset + limit]

    return JSONResponse(content={
        "total": total,
        "offset": offset,
        "limit": limit,
        "documents": page,
    })


# ── Excel pre-analysis ──────────────────────────────────────────────────────

@router.post("/ingest/excel/analyze")
async def analyze_excel(
    request: Request,
    file: UploadFile = File(...),
    user: TokenUser = Depends(get_current_user),
):
    """
    Analyse an Excel file's structure WITHOUT running the full pipeline.

    Returns sheet classifications, detected headers, column types, and
    whether each sheet is suitable for structured (row-by-row) extraction.

    The frontend uses this to show a sheet preview + mapping UI before
    the user confirms and triggers the full pipeline run.

    Request: multipart/form-data with a .xlsx or .xlsm file.

    Response:
    {
        "filename": "vendors.xlsx",
        "sheet_count": 3,
        "structured_sheet_count": 2,
        "sheets": [
            {
                "name": "Vendors",
                "classification": "vendor_list",
                "header_row_index": 1,
                "total_rows": 45,
                "data_rows": 43,
                "total_cols": 7,
                "columns": [
                    {"index": 0, "letter": "A", "header": "Vendor Name",
                     "col_type": "text", "non_empty_rows": 43, "sample_values": [...]}
                ],
                "has_merged_cells": false,
                "is_structured": true,
                "skip_reason": "",
                "formula_columns": ["G"]
            }
        ]
    }
    """
    from pipeline.parsers.excel_intelligence import analyse_workbook, workbook_analysis_to_dict

    suffix = Path(file.filename).suffix.lower()
    if suffix not in (".xlsx", ".xlsm"):
        raise HTTPException(
            status_code=415,
            detail=f"Excel analysis only supports .xlsx and .xlsm files. Got: '{suffix}'",
        )

    content = await file.read()

    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(content) / 1024 / 1024:.1f} MB). Maximum: {MAX_UPLOAD_SIZE / 1024 / 1024:.0f} MB.",
        )

    # Validate magic bytes (Office Open XML = ZIP)
    if content[:4] != b"PK\x03\x04":
        raise HTTPException(
            status_code=415,
            detail="File content does not match expected Excel format.",
        )

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(content)
        tmp_path = Path(tmp.name)

    named_path = tmp_path.parent / file.filename
    tmp_path.rename(named_path)

    try:
        analysis = analyse_workbook(named_path)
        result = workbook_analysis_to_dict(analysis)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Excel analysis failed: {e}")
    finally:
        if named_path.exists():
            named_path.unlink()

    log_action(
        user_id=user.id,
        action="excel_analyze",
        resource_type="document",
        resource_id=file.filename,
        details={"size_bytes": len(content), "sheet_count": result.get("sheet_count")},
        ip_address=get_client_ip(request),
    )

    return JSONResponse(content=result)


# ── Excel template download ─────────────────────────────────────────────────

@router.get("/ingest/template/{entity_type}")
async def download_template(
    entity_type: str,
    user: TokenUser = Depends(get_current_user),
):
    """
    Download a pre-formatted .xlsx upload template for the given entity type.

    The template contains:
      - A 'Data' sheet with column headers, an example row, and 48 blank rows
      - Column-level data validation where applicable (dropdowns, date formats)
      - An 'Instructions' sheet with field descriptions and examples

    Path parameter:
        entity_type — one of: vendor, customer, employee, product,
                      transaction, contract, financial_record, business_unit

    Returns:
        application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
        Content-Disposition: attachment; filename="dataarch_<entity_type>_template.xlsx"
    """
    from pipeline.excel_templates import generate_template, get_supported_entity_types

    supported = get_supported_entity_types()
    if entity_type.lower() not in supported:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No template available for entity type '{entity_type}'. "
                f"Supported types: {supported}"
            ),
        )

    try:
        xlsx_bytes = generate_template(entity_type.lower())
    except ImportError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Template generation failed: {e}")

    filename = f"dataarch_{entity_type.lower()}_template.xlsx"

    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/ingest/templates")
async def list_templates(
    user: TokenUser = Depends(get_current_user),
):
    """
    List all available entity type templates with their column definitions.

    Returns a JSON object mapping each entity type to its template metadata,
    useful for building a template picker UI or API docs.
    """
    from pipeline.excel_templates import get_supported_entity_types, get_template_columns

    result = {}
    for entity_type in get_supported_entity_types():
        cols = get_template_columns(entity_type)
        result[entity_type] = {
            "entity_type": entity_type,
            "download_url": f"/ingest/template/{entity_type}",
            "filename": f"dataarch_{entity_type}_template.xlsx",
            "column_count": len(cols),
            "columns": [
                {
                    "name": c["name"],
                    "header": c["header"],
                    "description": c["description"],
                    "required": c.get("required", False),
                    "sql_type_hint": c.get("sql_type_hint", "VARCHAR(255)"),
                }
                for c in cols
            ],
        }

    return JSONResponse(content={
        "template_count": len(result),
        "templates": result,
    })
