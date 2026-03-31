"""
pipeline/pipeline_runner.py — One-click pipeline orchestrator for DataArch.AI.

Runs the full data pipeline as an async background job:
  1. Ingest document (parse + extract entities via Claude)
  2. Ontology mapping (classify entities into PE types)
  3. Schema generation (produce PostgreSQL DDL)
  4. Database creation (execute DDL against PostgreSQL)
  5. Data loading (UPSERT entities into tables)
  6. Embedding generation (optional — requires Voyage AI key)

Each job gets a unique ID and can be polled for status via GET /pipeline/status/{job_id}.

Persistence (v0.9.2)
  - Job state is written to the pipeline_jobs PostgreSQL table (via
    services/job_store.py) on every significant state change.
  - The in-memory _jobs dict is kept as a fast read-through cache.
  - On a cache miss (e.g. after a server restart) get_job() falls back to the DB.
  - DB failures are non-fatal: the pipeline continues and the in-memory cache
    remains the fallback so the API stays functional.

Phase 4, Step 4.1 / v0.9.2
"""

from __future__ import annotations

import logging
import threading
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


# ── Job Status ───────────────────────────────────────────────────────────────

class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    PARTIAL = "partial"  # some steps succeeded, some failed


PIPELINE_STEPS = [
    "ingest",
    "ontology",
    "schema",
    "database_create",
    "data_load",
    "embed",
]


@dataclass
class StepResult:
    """Result of a single pipeline step."""
    step: str
    status: str = "pending"  # pending | running | success | failed | skipped
    started_at: str | None = None
    completed_at: str | None = None
    duration_ms: int | None = None
    detail: dict | None = None
    error: str | None = None


@dataclass
class PipelineJob:
    """Tracks the full state of a pipeline run."""
    job_id: str
    filename: str
    status: str = "queued"
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    started_at: str | None = None
    completed_at: str | None = None
    duration_ms: int | None = None
    steps: dict[str, StepResult] = field(default_factory=dict)
    error: str | None = None
    document_id: str | None = None
    company_id: int | None = None       # Phase 5: portfolio company association
    company_slug: str | None = None     # Phase 5: resolved from company_id
    selected_sheets: list[str] | None = None  # v0.9.5: user-selected Excel sheets (None = all)

    def __post_init__(self):
        if not self.steps:
            self.steps = {name: StepResult(step=name) for name in PIPELINE_STEPS}

    def to_dict(self) -> dict:
        return {
            "job_id": self.job_id,
            "filename": self.filename,
            "status": self.status,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "duration_ms": self.duration_ms,
            "document_id": self.document_id,
            "company_id": self.company_id,
            "company_slug": self.company_slug,
            "selected_sheets": self.selected_sheets,
            "error": self.error,
            "steps": {
                name: {
                    "step": s.step,
                    "status": s.status,
                    "started_at": s.started_at,
                    "completed_at": s.completed_at,
                    "duration_ms": s.duration_ms,
                    "detail": s.detail,
                    "error": s.error,
                }
                for name, s in self.steps.items()
            },
        }


# ── Job Store — in-memory cache + DB write-through ───────────────────────────

_jobs: dict[str, PipelineJob] = {}
_lock = threading.Lock()


def get_job(job_id: str) -> PipelineJob | None:
    """
    Retrieve a job by ID.

    Cache-first: returns the in-memory PipelineJob if present (active or
    recently completed jobs).  Falls back to the DB for jobs created in a
    previous server process (post-restart recovery).  The DB row is
    reconstructed into a PipelineJob and cached so subsequent polls are fast.
    """
    with _lock:
        if job_id in _jobs:
            return _jobs[job_id]

    # Cache miss — try the persistent store
    from services.job_store import load_job
    row = load_job(job_id)
    if row is None:
        return None

    # Reconstruct a PipelineJob from the DB row so callers get a consistent type
    job = _job_from_dict(row)
    with _lock:
        _jobs[job_id] = job  # warm the cache
    return job


def list_jobs(limit: int = 20) -> list[dict]:
    """
    List recent jobs, newest first.

    Merges the in-memory cache (which has live step-by-step progress for
    running jobs) with DB rows (for jobs from previous server processes).
    DB rows take precedence for completed/failed jobs; in-memory wins for
    running/queued jobs (fresher step data).
    """
    from services.job_store import load_recent_jobs

    db_jobs: dict[str, dict] = {j["job_id"]: j for j in load_recent_jobs(limit)}

    with _lock:
        mem_jobs: dict[str, dict] = {jid: j.to_dict() for jid, j in _jobs.items()}

    # Merge: in-memory wins for jobs that exist in both (live progress data)
    merged: dict[str, dict] = {**db_jobs, **mem_jobs}

    # Sort by created_at descending, return top `limit`
    sorted_jobs = sorted(
        merged.values(),
        key=lambda j: j.get("created_at") or "",
        reverse=True,
    )
    return sorted_jobs[:limit]


# ── Job Reconstruction (from DB rows) ────────────────────────────────────────

def _job_from_dict(d: dict) -> PipelineJob:
    """
    Reconstruct a PipelineJob from a serialised dict (e.g. loaded from the DB).
    Step results are rebuilt from the stored steps_json if present.
    """
    job = PipelineJob(
        job_id=d["job_id"],
        filename=d["filename"],
        status=d.get("status", "unknown"),
        created_at=d.get("created_at") or datetime.now(timezone.utc).isoformat(),
        started_at=d.get("started_at"),
        completed_at=d.get("completed_at"),
        duration_ms=d.get("duration_ms"),
        error=d.get("error"),
        document_id=d.get("document_id"),
        company_id=d.get("company_id"),
        company_slug=d.get("company_slug"),
        selected_sheets=d.get("selected_sheets"),
    )
    # Restore per-step results if available
    steps_data = d.get("steps") or {}
    if steps_data:
        for step_name, step_dict in steps_data.items():
            if step_name in job.steps:
                s = job.steps[step_name]
                s.status = step_dict.get("status", "pending")
                s.started_at = step_dict.get("started_at")
                s.completed_at = step_dict.get("completed_at")
                s.duration_ms = step_dict.get("duration_ms")
                s.detail = step_dict.get("detail")
                s.error = step_dict.get("error")
    return job


# ── Step Execution Helpers ───────────────────────────────────────────────────

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _run_step(job: PipelineJob, step_name: str, fn, *args, **kwargs) -> Any:
    """
    Execute a pipeline step with timing and error tracking.
    Returns the step's result on success, raises on failure.
    """
    step = job.steps[step_name]
    step.status = "running"
    step.started_at = _now()
    logger.info(f"[{job.job_id}] Step '{step_name}' started.")

    t0 = time.monotonic()
    try:
        result = fn(*args, **kwargs)
        elapsed = int((time.monotonic() - t0) * 1000)
        step.status = "success"
        step.completed_at = _now()
        step.duration_ms = elapsed

        # Store a summary of the result (avoid storing huge payloads)
        if isinstance(result, dict):
            step.detail = _summarize_result(result)
        logger.info(f"[{job.job_id}] Step '{step_name}' completed in {elapsed}ms.")
        return result
    except Exception as e:
        elapsed = int((time.monotonic() - t0) * 1000)
        step.status = "failed"
        step.completed_at = _now()
        step.duration_ms = elapsed
        step.error = str(e)
        logger.error(f"[{job.job_id}] Step '{step_name}' failed: {e}")
        raise


def _summarize_result(result: dict) -> dict:
    """Create a compact summary of a step result for status reporting."""
    summary = {}
    # Copy small scalar values
    for key in ("status", "count", "mapped", "tables_created", "tables_failed",
                "entities_loaded", "entities_skipped", "entities_failed",
                "row_count", "embedded_count"):
        if key in result:
            summary[key] = result[key]
    # Copy lists of names (not full objects)
    if "tables" in result and isinstance(result["tables"], list):
        if result["tables"] and isinstance(result["tables"][0], dict):
            summary["table_count"] = len(result["tables"])
        else:
            summary["tables"] = result["tables"]
    if "documents" in result:
        summary["documents"] = result["documents"]
    return summary


# ── Main Pipeline Execution ──────────────────────────────────────────────────

def run_pipeline(
    file_path: Path,
    filename: str,
    skip_embed: bool = False,
    company_id: int | None = None,
    selected_sheets: list[str] | None = None,
) -> str:
    """
    Launch the full pipeline as a background thread.

    Args:
        file_path: Path to the uploaded file on disk.
        filename: Original filename (for naming outputs).
        skip_embed: If True, skip the embedding step (no Voyage API key).
        company_id: Portfolio company ID to associate entities with (Phase 5).
        selected_sheets: List of Excel sheet names to process. None = process all.
            Only relevant for .xlsx/.xlsm files; ignored for other formats.

    Returns:
        job_id: Unique identifier for polling status.
    """
    job_id = str(uuid.uuid4())[:8]
    job = PipelineJob(
        job_id=job_id,
        filename=filename,
        company_id=company_id,
        selected_sheets=selected_sheets,
    )

    with _lock:
        _jobs[job_id] = job

    # Persist to DB immediately so the job is visible even if the process restarts
    from services.job_store import persist_job_created
    persist_job_created(job_id=job_id, filename=filename, company_id=company_id)

    thread = threading.Thread(
        target=_execute_pipeline,
        args=(job, file_path, skip_embed),
        daemon=True,
    )
    thread.start()

    logger.info(f"Pipeline job '{job_id}' queued for '{filename}'"
                f"{f' (company_id={company_id})' if company_id else ''}.")
    return job_id


def _steps_to_dict(job: "PipelineJob") -> dict:
    """Serialise a job's steps to a plain dict suitable for JSON / DB storage."""
    return {
        name: {
            "step": s.step,
            "status": s.status,
            "started_at": s.started_at,
            "completed_at": s.completed_at,
            "duration_ms": s.duration_ms,
            "detail": s.detail,
            "error": s.error,
        }
        for name, s in job.steps.items()
    }


def _resolve_company_slug(company_id: int | None) -> str | None:
    """Resolve company_id → company_slug for the ontology layer. Returns None if not found."""
    if company_id is None:
        return None
    try:
        from pipeline.company import get_company
        company = get_company(company_id)
        if company:
            return company.slug
    except Exception as e:
        logger.warning(f"Could not resolve company slug for id={company_id}: {e}")
    return None


def _execute_pipeline(job: PipelineJob, file_path: Path, skip_embed: bool):
    """Run all pipeline steps sequentially in a background thread."""
    from services.job_store import (
        persist_job_started,
        persist_job_completed,
        persist_step_update,
    )
    from services.logging_config import set_job_context

    # Set job_id in logging context so all pipeline logs include it
    set_job_context(job.job_id)

    job.status = "running"
    job.started_at = _now()
    t0 = time.monotonic()

    # Persist running state immediately
    persist_job_started(job.job_id, job.started_at)

    all_success = True

    # Phase 5: resolve company slug from company_id
    company_slug = _resolve_company_slug(job.company_id)
    job.company_slug = company_slug

    try:
        # ── Step 1: Ingest ──────────────────────────────────
        from pipeline.ingest import ingest
        from pipeline.schema import ParsedDocument

        if job.selected_sheets:
            logger.info(
                f"[{job.job_id}] Sheet filter active: processing "
                f"{len(job.selected_sheets)} sheet(s): {job.selected_sheets}"
            )

        parsed: ParsedDocument = _run_step(
            job, "ingest", ingest, file_path,
            selected_sheets=job.selected_sheets,
        )
        persist_step_update(job.job_id, _steps_to_dict(job))
        doc_id = file_path.stem.replace(" ", "_")
        job.document_id = doc_id
        job.steps["ingest"].detail = {
            "entities": len(parsed.entities),
            "status": parsed.status.value if hasattr(parsed.status, "value") else str(parsed.status),
        }

        # ── Step 2: Ontology Mapping ────────────────────────
        from pipeline.ontology.mapper import map_from_parsed_json
        from pathlib import Path as P

        parsed_path = P(f"outputs/{doc_id}.json")
        if not parsed_path.exists():
            # The ingest step saves output — find it
            candidates = list(P("outputs").glob(f"{file_path.stem}*.json"))
            if candidates:
                parsed_path = candidates[0]
                doc_id = parsed_path.stem
                job.document_id = doc_id

        # Phase 5: pass company_slug to ontology mapper
        ont_result = _run_step(
            job, "ontology", map_from_parsed_json, parsed_path,
            company_slug=company_slug,
        )
        job.steps["ontology"].detail = {
            "mapped": len(ont_result.records),
            "unmapped": ont_result.unmapped_count if hasattr(ont_result, "unmapped_count") else 0,
        }
        persist_step_update(job.job_id, _steps_to_dict(job))

        # ── Step 3: Schema Generation ──────────────────────
        from pipeline.schema_generator import generate_and_save as gen_schema

        schema = _run_step(job, "schema", gen_schema)
        job.steps["schema"].detail = {
            "table_count": len(schema.get("tables", [])),
        }
        persist_step_update(job.job_id, _steps_to_dict(job))

        # ── Step 4: Database Create ─────────────────────────
        try:
            from pipeline.database import execute_schema, load_schema_from_file

            db_schema = load_schema_from_file()
            db_result = _run_step(
                job, "database_create", execute_schema, db_schema
            )
        except Exception as e:
            job.steps["database_create"].status = "failed"
            job.steps["database_create"].error = str(e)
            job.steps["database_create"].completed_at = _now()
            all_success = False
            logger.warning(f"[{job.job_id}] database_create failed (non-fatal): {e}")
        persist_step_update(job.job_id, _steps_to_dict(job))

        # ── Step 5: Data Load ───────────────────────────────
        if job.steps["database_create"].status == "success":
            try:
                from pipeline.data_loader import load_from_files

                # Phase 5: pass company_id to data loader for per-company isolation
                load_result = _run_step(
                    job, "data_load", load_from_files,
                    company_id=job.company_id,
                )
            except Exception as e:
                job.steps["data_load"].status = "failed"
                job.steps["data_load"].error = str(e)
                job.steps["data_load"].completed_at = _now()
                all_success = False
                logger.warning(f"[{job.job_id}] data_load failed (non-fatal): {e}")
        else:
            job.steps["data_load"].status = "skipped"
            job.steps["data_load"].detail = {"reason": "database_create failed"}
            all_success = False
        persist_step_update(job.job_id, _steps_to_dict(job))

        # ── Step 6: Embeddings (optional) ───────────────────
        if skip_embed:
            job.steps["embed"].status = "skipped"
            job.steps["embed"].detail = {"reason": "skip_embed=true"}
        elif job.steps["data_load"].status != "success":
            job.steps["embed"].status = "skipped"
            job.steps["embed"].detail = {"reason": "data_load did not succeed"}
            all_success = False
        else:
            try:
                from pipeline.embeddings import setup_pgvector, embed_all_entities

                _run_step(job, "embed", lambda: (
                    setup_pgvector(),
                    embed_all_entities(company_id=job.company_id),
                ))
            except (EnvironmentError, ImportError) as e:
                job.steps["embed"].status = "skipped"
                job.steps["embed"].detail = {"reason": f"Embeddings unavailable: {e}"}
            except Exception as e:
                job.steps["embed"].status = "failed"
                job.steps["embed"].error = str(e)
                job.steps["embed"].completed_at = _now()
                all_success = False

        # ── Final Status ────────────────────────────────────
        elapsed = int((time.monotonic() - t0) * 1000)
        job.duration_ms = elapsed
        job.completed_at = _now()

        # Check if core steps (ingest, ontology, schema) all passed
        core_steps = ["ingest", "ontology", "schema"]
        core_ok = all(job.steps[s].status == "success" for s in core_steps)

        if all_success:
            job.status = "completed"
        elif core_ok:
            job.status = "partial"
        else:
            job.status = "failed"

        # Persist final state to DB
        persist_job_completed(
            job_id=job.job_id,
            status=job.status,
            completed_at=job.completed_at,
            duration_ms=job.duration_ms,
            steps=_steps_to_dict(job),
            error=job.error,
        )

        logger.info(
            f"[{job.job_id}] Pipeline finished in {elapsed}ms. "
            f"Status: {job.status}"
        )

    except Exception as e:
        elapsed = int((time.monotonic() - t0) * 1000)
        job.duration_ms = elapsed
        job.completed_at = _now()
        job.status = "failed"
        job.error = str(e)
        logger.error(f"[{job.job_id}] Pipeline failed: {e}")

        # Report to Sentry if configured
        try:
            import sentry_sdk
            sentry_sdk.capture_exception(e)
        except ImportError:
            pass

        # Persist failure to DB even on unexpected exception
        persist_job_completed(
            job_id=job.job_id,
            status="failed",
            completed_at=job.completed_at,
            duration_ms=job.duration_ms,
            steps=_steps_to_dict(job),
            error=str(e),
        )
