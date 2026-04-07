"""
services/job_store.py — Persistent pipeline job store for DataArch.AI.

Provides a thin DB-backed layer over the pipeline_jobs table (created by
Alembic migration 001).  pipeline_runner.py calls these functions instead of
operating directly on the in-memory _jobs dict.

Design
------
  - All writes go to the DB first, then update the in-memory cache.
  - Reads check the in-memory cache first; fall back to the DB on a miss
    (handles restarts where the cache is cold).
  - DB failures are logged but never propagate — the pipeline never crashes
    because the job store is unavailable.  The in-memory cache is the
    ultimate fallback so the API stays functional.

Why DB-first?
  - Survives server restarts: jobs started before a restart are still
    queryable via GET /pipeline/status/{job_id}.
  - Foundation for future work: Celery workers, multi-process deployments,
    and the jobs dashboard all need a shared, persistent source of truth.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import text
from sqlalchemy.exc import OperationalError, ProgrammingError

logger = logging.getLogger(__name__)

# ── Helpers ──────────────────────────────────────────────────────────────────


def _get_engine():
    """Lazy import to avoid circular dependencies at module load."""
    from pipeline.database import get_engine
    return get_engine()


def _to_dt(iso_str: str | None) -> datetime | None:
    """Convert an ISO 8601 string to a naive UTC datetime for PostgreSQL."""
    if iso_str is None:
        return None
    try:
        dt = datetime.fromisoformat(iso_str)
        # Strip timezone info — PostgreSQL TIMESTAMP (without time zone) columns
        # don't accept timezone-aware datetimes from SQLAlchemy text() binds.
        return dt.replace(tzinfo=None)
    except Exception:
        return None


# ── Write operations ─────────────────────────────────────────────────────────


def persist_job_created(job_id: str, filename: str, company_id: int | None) -> None:
    """
    Insert a new job row when a pipeline job is first created (status = queued).
    Non-blocking — failures are logged and swallowed.
    """
    try:
        engine = _get_engine()
        with engine.begin() as conn:
            conn.execute(
                text("""
                    INSERT INTO pipeline_jobs
                        (job_id, filename, status, company_id, created_at)
                    VALUES
                        (:job_id, :filename, 'queued', :company_id, NOW())
                    ON CONFLICT (job_id) DO NOTHING
                """),
                {"job_id": job_id, "filename": filename, "company_id": company_id},
            )
    except (OperationalError, ProgrammingError) as e:
        logger.warning("job_store.persist_job_created failed: %s (job_id=%s)", e, job_id)


def persist_job_started(job_id: str, started_at: str) -> None:
    """Update the job row to running + set started_at."""
    try:
        engine = _get_engine()
        with engine.begin() as conn:
            conn.execute(
                text("""
                    UPDATE pipeline_jobs
                       SET status = 'running', started_at = :started_at
                     WHERE job_id = :job_id
                """),
                {"job_id": job_id, "started_at": _to_dt(started_at)},
            )
    except (OperationalError, ProgrammingError) as e:
        logger.warning("job_store.persist_job_started failed: %s (job_id=%s)", e, job_id)


def persist_job_completed(
    job_id: str,
    status: str,
    completed_at: str,
    duration_ms: int | None,
    steps: dict[str, Any],
    error: str | None = None,
) -> None:
    """
    Update the job row with the final status, timing, per-step results, and
    any top-level error message.

    steps is the full steps dict from PipelineJob (serialised to JSONB).
    """
    try:
        engine = _get_engine()
        with engine.begin() as conn:
            conn.execute(
                text("""
                    UPDATE pipeline_jobs
                       SET status       = :status,
                           completed_at = :completed_at,
                           duration_ms  = :duration_ms,
                           steps_json   = :steps_json::jsonb,
                           error        = :error
                     WHERE job_id = :job_id
                """),
                {
                    "job_id": job_id,
                    "status": status,
                    "completed_at": _to_dt(completed_at),
                    "duration_ms": duration_ms,
                    "steps_json": json.dumps(steps),
                    "error": error,
                },
            )
    except (OperationalError, ProgrammingError) as e:
        logger.warning("job_store.persist_job_completed failed: %s (job_id=%s)", e, job_id)


def persist_step_update(
    job_id: str,
    steps: dict[str, Any],
) -> None:
    """
    Persist the current per-step state mid-run so that in-progress jobs are
    visible on restart (partial recovery).
    """
    try:
        engine = _get_engine()
        with engine.begin() as conn:
            conn.execute(
                text("""
                    UPDATE pipeline_jobs
                       SET steps_json = :steps_json::jsonb
                     WHERE job_id = :job_id
                """),
                {"job_id": job_id, "steps_json": json.dumps(steps)},
            )
    except (OperationalError, ProgrammingError) as e:
        logger.debug("job_store.persist_step_update failed (non-critical): %s", e)


# ── Read operations ───────────────────────────────────────────────────────────


def load_job(job_id: str) -> dict | None:
    """
    Load a job from the DB by job_id.
    Returns the row as a dict matching PipelineJob.to_dict(), or None.
    """
    try:
        engine = _get_engine()
        with engine.connect() as conn:
            result = conn.execute(
                text("""
                    SELECT job_id, filename, status, company_id,
                           steps_json, error,
                           created_at, started_at, completed_at, duration_ms
                      FROM pipeline_jobs
                     WHERE job_id = :job_id
                """),
                {"job_id": job_id},
            ).fetchone()
        if result is None:
            return None
        return _row_to_dict(result)
    except (OperationalError, ProgrammingError) as e:
        logger.warning("job_store.load_job failed: %s (job_id=%s)", e, job_id)
        return None


def load_recent_jobs(limit: int = 20) -> list[dict]:
    """
    Load the most recent jobs from the DB (newest first).
    Returns a list of dicts matching PipelineJob.to_dict().
    """
    try:
        engine = _get_engine()
        with engine.connect() as conn:
            rows = conn.execute(
                text("""
                    SELECT job_id, filename, status, company_id,
                           steps_json, error,
                           created_at, started_at, completed_at, duration_ms
                      FROM pipeline_jobs
                     ORDER BY created_at DESC
                     LIMIT :limit
                """),
                {"limit": limit},
            ).fetchall()
        return [_row_to_dict(row) for row in rows]
    except (OperationalError, ProgrammingError) as e:
        logger.warning("job_store.load_recent_jobs failed: %s", e)
        return []


def _row_to_dict(row) -> dict:
    """Convert a DB row to the canonical PipelineJob.to_dict() shape."""
    steps_json = row.steps_json or {}
    # steps_json may be a dict already (SQLAlchemy JSON column) or a raw string
    if isinstance(steps_json, str):
        try:
            steps_json = json.loads(steps_json)
        except Exception:
            steps_json = {}

    def _fmt_dt(dt) -> str | None:
        if dt is None:
            return None
        if isinstance(dt, datetime):
            return dt.replace(tzinfo=timezone.utc).isoformat()
        return str(dt)

    return {
        "job_id": row.job_id,
        "filename": row.filename,
        "status": row.status,
        "company_id": row.company_id,
        "company_slug": None,  # not stored in DB; populated from cache where available
        "document_id": None,   # not stored in DB; populated from cache where available
        "error": row.error,
        "created_at": _fmt_dt(row.created_at),
        "started_at": _fmt_dt(row.started_at),
        "completed_at": _fmt_dt(row.completed_at),
        "duration_ms": row.duration_ms,
        "steps": steps_json,
    }
