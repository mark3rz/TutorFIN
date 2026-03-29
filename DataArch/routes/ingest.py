"""
routes/ingest.py — Document ingestion and results endpoints.

Endpoints:
  POST /ingest            Upload a document, get structured extraction
  GET  /results           List all saved output files
  GET  /results/{id}      Fetch a specific result by filename stem
  POST /pipeline/run      One-click full pipeline (background job)
  GET  /pipeline/status/{id}  Poll pipeline job status
  GET  /pipeline/jobs     List recent pipeline jobs
"""

from __future__ import annotations

import json
import shutil
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse

import config
from auth import TokenUser, get_optional_user
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
    user: Optional[TokenUser] = Depends(get_optional_user),
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
        user_id=user.id if user else None,
        action="ingest",
        resource_type="document",
        resource_id=file.filename,
        details={"size_bytes": len(content), "format": suffix},
        ip_address=get_client_ip(request),
    )

    return JSONResponse(content=result.to_output_dict())


# ── Results ────────────────────────────────────────────────────────────────

@router.get("/results")
def list_results(user: Optional[TokenUser] = Depends(get_optional_user)):
    """List all previously parsed document results."""
    files = sorted(OUTPUTS_DIR.glob("*.json"))
    return {"count": len(files), "results": [f.stem for f in files]}


@router.get("/results/{document_id}")
def get_result(document_id: str, user: Optional[TokenUser] = Depends(get_optional_user)):
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
    user: Optional[TokenUser] = Depends(get_optional_user),
):
    """One-click pipeline: upload a document and run the full pipeline.

    Steps: ingest → ontology → schema → database create → data load → embed.
    Returns immediately with a job_id. Poll GET /pipeline/status/{job_id} for progress.
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
    if user and not user.is_pe_admin and user.company_id:
        company_id = user.company_id

    job_id = run_pipeline(
        file_path=named_path,
        filename=file.filename,
        skip_embed=skip_embed,
        company_id=company_id,
    )

    log_action(
        user_id=user.id if user else None,
        action="pipeline_run",
        resource_type="document",
        resource_id=file.filename,
        details={"job_id": job_id, "company_id": company_id, "size_bytes": len(content)},
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
def pipeline_status(job_id: str, user: Optional[TokenUser] = Depends(get_optional_user)):
    """Poll the status of a pipeline job."""
    from pipeline.pipeline_runner import get_job

    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Pipeline job '{job_id}' not found.")
    return JSONResponse(content=job.to_dict())


@router.get("/pipeline/jobs")
def pipeline_jobs(user: Optional[TokenUser] = Depends(get_optional_user)):
    """List recent pipeline jobs (newest first)."""
    from pipeline.pipeline_runner import list_jobs

    return JSONResponse(content={"jobs": list_jobs()})


# ── Excel pre-analysis ──────────────────────────────────────────────────────

@router.post("/ingest/excel/analyze")
async def analyze_excel(
    request: Request,
    file: UploadFile = File(...),
    user: Optional[TokenUser] = Depends(get_optional_user),
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
        user_id=user.id if user else None,
        action="excel_analyze",
        resource_type="document",
        resource_id=file.filename,
        details={"size_bytes": len(content), "sheet_count": result.get("sheet_count")},
        ip_address=get_client_ip(request),
    )

    return JSONResponse(content=result)
