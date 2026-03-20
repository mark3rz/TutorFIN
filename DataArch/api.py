"""
api.py — FastAPI server for DataArch.AI.

Endpoints:
  POST /ingest              Upload a document, get structured extraction back
  GET  /results             List all saved output files
  GET  /results/{id}        Fetch a specific result by filename stem

  POST /ontology/map/{id}   Run ontology mapper on a parsed document
  POST /ontology/map-all    Map all parsed documents
  GET  /ontology/registry   Get the full entity registry
  GET  /ontology/{id}       Get ontology result for a document

  POST /schema/generate     Generate schema from current entity registry
  GET  /schema              Get the structured schema.json
  GET  /schema/sql          Get the raw DDL as text

  POST /dataflow/generate   Generate data flow graph from registry + schema
  GET  /dataflow            Get the data flow graph JSON

  GET  /                    Demo UI (Layer 5)
  GET  /static/*            Static file serving for frontend assets
"""

import json
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse, PlainTextResponse, HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import shutil
import tempfile

from pipeline.ingest import ingest
from pipeline.schema import ParsedDocument
from pipeline.ontology.mapper import map_document, map_all_outputs, map_from_parsed_json
from pipeline.ontology.schema import EntityRegistry
from pipeline.schema_generator import generate_and_save as generate_schema_and_save, SCHEMA_OUTPUT_DIR
from pipeline.dataflow import generate_and_save as generate_dataflow_and_save, DATAFLOW_OUTPUT_DIR

app = FastAPI(
    title="DataArch.AI API",
    description="Upload business documents. Get structured, AI-ready data back.",
    version="0.3.0",
)

OUTPUTS_DIR = Path("outputs")
OUTPUTS_DIR.mkdir(exist_ok=True)

FRONTEND_DIR = Path(__file__).parent / "frontend"
SUPPORTED_EXTENSIONS = {".pdf", ".xlsx", ".xlsm", ".csv", ".docx", ".eml"}

# Mount static files for frontend assets
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")


# ── Root — Demo UI ───────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
def root():
    """Serve the DataArch.AI demo UI."""
    index_path = FRONTEND_DIR / "index.html"
    if index_path.exists():
        return HTMLResponse(content=index_path.read_text())
    return HTMLResponse(content="<h1>DataArch.AI</h1><p>Frontend not found.</p>")


@app.get("/health")
def health():
    return {"status": "ok", "product": "DataArch.AI", "version": "0.3.0"}


# ── Layer 1: Ingestion ──────────────────────────────────────────────────────

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


# ── Layer 2: Ontology ───────────────────────────────────────────────────────

ONTOLOGY_DIR = Path("outputs/ontology")


@app.post("/ontology/map/{document_id}")
def map_ontology(document_id: str):
    """
    Run the ontology mapper on a previously parsed document.
    Requires the document to have been ingested first via POST /ingest.
    """
    parsed_path = OUTPUTS_DIR / f"{document_id}.json"
    if not parsed_path.exists():
        raise HTTPException(status_code=404, detail=f"No parsed result found for '{document_id}'. Ingest it first.")
    try:
        result = map_from_parsed_json(parsed_path)
        return JSONResponse(content=result.to_output_dict())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ontology/map-all")
def map_all():
    """Run the ontology mapper across all parsed documents in outputs/."""
    try:
        results = map_all_outputs()
        return {"mapped": len(results), "documents": [r.source_file for r in results]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/ontology/registry")
def get_registry():
    """Return the full entity registry (all unique canonical entities seen so far)."""
    registry_path = ONTOLOGY_DIR / "entity_registry.json"
    if not registry_path.exists():
        return {"entries": {}, "updated_at": None}
    return JSONResponse(content=json.loads(registry_path.read_text()))


@app.get("/ontology/{document_id}")
def get_ontology_result(document_id: str):
    """Fetch the ontology mapping result for a specific document."""
    path = ONTOLOGY_DIR / f"{document_id}_ontology.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"No ontology result for '{document_id}'.")
    return JSONResponse(content=json.loads(path.read_text()))


# ── Layer 3: Schema ─────────────────────────────────────────────────────────

@app.post("/schema/generate")
def generate_schema_endpoint():
    """
    Generate a PostgreSQL schema from the current entity registry.
    Writes schema.sql and schema.json to outputs/schema/.
    """
    try:
        schema = generate_schema_and_save()
        return JSONResponse(content=schema)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/schema")
def get_schema():
    """Return the generated schema.json."""
    path = SCHEMA_OUTPUT_DIR / "schema.json"
    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail="Schema not generated yet. Run POST /schema/generate first.",
        )
    return JSONResponse(content=json.loads(path.read_text()))


@app.get("/schema/sql")
def get_schema_sql():
    """Return the generated schema.sql DDL as plain text."""
    path = SCHEMA_OUTPUT_DIR / "schema.sql"
    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail="Schema not generated yet. Run POST /schema/generate first.",
        )
    return PlainTextResponse(content=path.read_text())


# ── Layer 4: Data Flow ──────────────────────────────────────────────────────

@app.post("/dataflow/generate")
def generate_dataflow_endpoint():
    """
    Generate the data flow graph from the entity registry and schema.
    Writes dataflow.json to outputs/dataflow/.
    """
    try:
        graph = generate_dataflow_and_save()
        return JSONResponse(content=graph)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/dataflow")
def get_dataflow():
    """Return the generated data flow graph JSON."""
    path = DATAFLOW_OUTPUT_DIR / "dataflow.json"
    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail="Data flow graph not generated yet. Run POST /dataflow/generate first.",
        )
    return JSONResponse(content=json.loads(path.read_text()))
