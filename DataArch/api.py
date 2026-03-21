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

  POST /database/create     Execute DDL, create all tables in PostgreSQL
  POST /database/load       Load entity registry into database tables
  POST /database/reset      Drop and recreate all tables
  GET  /database/health     Check database connectivity
  GET  /database/stats      Row counts and table sizes
  POST /database/query      Execute read-only SQL query

  POST /pipeline/run        One-click: upload + full pipeline as background job
  GET  /pipeline/status/{id} Poll pipeline job status
  GET  /pipeline/jobs       List recent pipeline jobs

  POST /ai/embed            Generate vector embeddings for all entities
  POST /ai/search           Semantic search across entity data
  POST /ai/ask              Natural language SQL analytics

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

import config
from pipeline.ingest import ingest
from pipeline.schema import ParsedDocument
from pipeline.ontology.mapper import map_document, map_all_outputs, map_from_parsed_json
from pipeline.ontology.schema import EntityRegistry
from pipeline.schema_generator import generate_and_save as generate_schema_and_save, SCHEMA_OUTPUT_DIR
from pipeline.dataflow import generate_and_save as generate_dataflow_and_save, DATAFLOW_OUTPUT_DIR

app = FastAPI(
    title="DataArch.AI API",
    description="Upload business documents. Get structured, AI-ready data back.",
    version=config.APP_VERSION,
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
    return {"status": "ok", "product": config.APP_NAME, "version": config.APP_VERSION}


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


# ── Database Management (Phase 2) ──────────────────────────────────────────

@app.get("/database/health")
def database_health():
    """Check database connectivity and return status info."""
    from pipeline.database import check_health
    return JSONResponse(content=check_health())


@app.post("/database/create")
def database_create():
    """
    Execute the generated DDL against the PostgreSQL database.
    Creates all tables defined in schema.json.
    Tables are created in topological order with IF NOT EXISTS.
    """
    from pipeline.database import execute_schema, load_schema_from_file

    try:
        schema = load_schema_from_file()
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    try:
        result = execute_schema(schema)
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Schema execution failed: {e}")


@app.post("/database/load")
def database_load():
    """
    Load entity registry data into the PostgreSQL database.
    Transforms attribute values and UPSERTs into the appropriate tables.
    """
    from pipeline.data_loader import load_from_files

    try:
        result = load_from_files()
        return JSONResponse(content=result)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Data load failed: {e}")


@app.post("/database/reset")
def database_reset():
    """
    Drop and recreate all DataArch tables.
    WARNING: This permanently deletes all data in the tables.
    """
    from pipeline.database import drop_all_tables, execute_schema, load_schema_from_file

    try:
        schema = load_schema_from_file()
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    try:
        drop_result = drop_all_tables(schema)
        create_result = execute_schema(schema)
        return JSONResponse(content={
            "dropped": drop_result,
            "created": create_result,
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database reset failed: {e}")


@app.get("/database/stats")
def database_stats():
    """Get row counts and table sizes for all DataArch tables."""
    from pipeline.database import get_table_stats

    try:
        stats = get_table_stats()
        return JSONResponse(content=stats)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not get stats: {e}")


@app.post("/database/query")
def database_query(body: dict):
    """
    Execute a read-only SQL query against the database.
    Only SELECT and WITH (CTE) queries are allowed.

    Request body: {"sql": "SELECT * FROM vendor LIMIT 10"}
    """
    from pipeline.database import execute_readonly_query

    sql = body.get("sql", "").strip()
    if not sql:
        raise HTTPException(status_code=400, detail="Missing 'sql' field in request body.")

    try:
        result = execute_readonly_query(sql, max_rows=body.get("max_rows", 500))
        return JSONResponse(content=result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")


# ── Pipeline Automation (Phase 4) ──────────────────────────────────────────

@app.post("/pipeline/run")
async def pipeline_run(file: UploadFile = File(...)):
    """
    One-click pipeline: upload a document and run the full pipeline.

    Steps: ingest → ontology → schema → database create → data load → embed

    Returns immediately with a job_id. Poll GET /pipeline/status/{job_id} for progress.
    """
    from pipeline.pipeline_runner import run_pipeline

    suffix = Path(file.filename).suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{suffix}'. Supported: {sorted(SUPPORTED_EXTENSIONS)}",
        )

    # Save upload to a temp file
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = Path(tmp.name)

    # Rename to preserve original filename
    named_path = tmp_path.parent / file.filename
    if named_path.exists():
        named_path.unlink()
    tmp_path.rename(named_path)

    # Check if embeddings are available
    skip_embed = not config.VOYAGE_API_KEY

    job_id = run_pipeline(
        file_path=named_path,
        filename=file.filename,
        skip_embed=skip_embed,
    )

    return JSONResponse(content={
        "job_id": job_id,
        "filename": file.filename,
        "status": "queued",
        "status_url": f"/pipeline/status/{job_id}",
    })


@app.get("/pipeline/status/{job_id}")
def pipeline_status(job_id: str):
    """
    Poll the status of a pipeline job.

    Returns the full job state including per-step progress, timing, and errors.
    """
    from pipeline.pipeline_runner import get_job

    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Pipeline job '{job_id}' not found.")
    return JSONResponse(content=job.to_dict())


@app.get("/pipeline/jobs")
def pipeline_jobs():
    """List recent pipeline jobs (newest first)."""
    from pipeline.pipeline_runner import list_jobs

    return JSONResponse(content={"jobs": list_jobs()})


# ── AI Integration (Phase 3) ──────────────────────────────────────────────

@app.post("/ai/embed")
def ai_embed():
    """
    Generate vector embeddings for all entities and store in PostgreSQL.
    Requires: Voyage AI API key, pgvector extension, entities loaded in DB.
    """
    from pipeline.embeddings import setup_pgvector, embed_all_entities

    try:
        # Ensure pgvector is set up
        setup_result = setup_pgvector()
        if setup_result.get("errors"):
            return JSONResponse(content={
                "status": "pgvector_setup_failed",
                "setup": setup_result,
            }, status_code=500)

        # Generate and store embeddings
        embed_result = embed_all_entities()
        return JSONResponse(content={
            "status": "complete",
            "setup": setup_result,
            "embeddings": embed_result,
        })
    except ImportError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except EnvironmentError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding failed: {e}")


@app.post("/ai/search")
def ai_search(body: dict):
    """
    Semantic search across entity data using vector similarity.

    Request body: {"query": "which vendors have long payment terms?", "top_k": 10}

    Falls back to text search (ILIKE) if embeddings are not available.
    """
    from pipeline.ai_search import semantic_search, text_search

    query = body.get("query", "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="Missing 'query' field.")

    top_k = body.get("top_k", 10)
    entity_type = body.get("entity_type")

    try:
        result = semantic_search(query, top_k=top_k, entity_type=entity_type)
        return JSONResponse(content=result)
    except (EnvironmentError, ImportError):
        # No Voyage API key — fall back to text search
        try:
            result = text_search(query, top_k=top_k, entity_type=entity_type)
            result["note"] = "Vector search unavailable. Using text search fallback."
            return JSONResponse(content=result)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Search failed: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {e}")


@app.post("/ai/ask")
def ai_ask(body: dict):
    """
    Ask a business question in plain English.
    Claude generates SQL, executes it, and returns a natural language answer.

    Request body: {"question": "what is the total transaction volume by vendor?"}

    Returns: {"question": "...", "sql": "...", "answer": "...", "rows": [...]}
    """
    from pipeline.ai_analyst import ask

    question = body.get("question", "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="Missing 'question' field.")

    try:
        result = ask(question, max_rows=body.get("max_rows", 100))
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analytics failed: {e}")
