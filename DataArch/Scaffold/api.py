"""
api.py — FastAPI server for DataArch.AI ingestion pipeline.

Endpoints:
  POST /ingest        Upload a document, get structured extraction back
  GET  /results       List all saved output files
  GET  /results/{id}  Fetch a specific result by filename stem
"""

import json
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import shutil
import tempfile

from pipeline.ingest import ingest
from pipeline.schema import ParsedDocument

app = FastAPI(
    title="DataArch.AI Ingestion API",
    description="Upload business documents. Get structured, AI-ready data back.",
    version="0.1.0",
)

OUTPUTS_DIR = Path("outputs")
OUTPUTS_DIR.mkdir(exist_ok=True)

SUPPORTED_EXTENSIONS = {".pdf", ".xlsx", ".xlsm", ".csv", ".docx", ".doc", ".eml"}


@app.get("/")
def root():
    return {"status": "ok", "product": "DataArch.AI", "version": "0.1.0"}


@app.post("/ingest", response_model=dict)
async def ingest_document(file: UploadFile = File(...)):
    """
    Upload a document (PDF, Excel, DOCX, CSV, EML).
    Returns structured extraction as JSON.
    """
    suffix = Path(file.filename).suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{suffix}'. Supported: {sorted(SUPPORTED_EXTENSIONS)}",
        )

    # Save upload to a temp file (keeping the original extension)
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = Path(tmp.name)

    # Rename to preserve original filename for output naming
    named_path = tmp_path.parent / file.filename
    tmp_path.rename(named_path)

    try:
        result: ParsedDocument = ingest(named_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if named_path.exists():
            named_path.unlink()

    return JSONResponse(content=result.to_output_dict())


@app.get("/results")
def list_results():
    """List all previously parsed document results."""
    files = sorted(OUTPUTS_DIR.glob("*.json"))
    return {
        "count": len(files),
        "results": [f.stem for f in files],
    }


@app.get("/results/{document_id}")
def get_result(document_id: str):
    """Fetch a specific parsed result by document name (without .json)."""
    path = OUTPUTS_DIR / f"{document_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Result '{document_id}' not found.")
    return JSONResponse(content=json.loads(path.read_text()))
