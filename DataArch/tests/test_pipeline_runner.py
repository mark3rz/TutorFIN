"""
tests/test_pipeline_runner.py — Tests for the pipeline runner module.

Tests cover:
  - Job creation and state management
  - Step result tracking
  - Job listing and retrieval
  - Pipeline step names and ordering
  - API endpoint validation
"""

import pytest
import sys
import os
import time

# Ensure project root is on sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from pipeline.pipeline_runner import (
    PipelineJob,
    StepResult,
    JobStatus,
    PIPELINE_STEPS,
    get_job,
    list_jobs,
    _jobs,
    _lock,
    _summarize_result,
)


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def clean_jobs():
    """Clear the job store before each test."""
    with _lock:
        _jobs.clear()
    yield
    with _lock:
        _jobs.clear()


# ── PipelineJob Tests ────────────────────────────────────────────────────────

def test_pipeline_job_creation():
    """A new PipelineJob should have all steps initialized as pending."""
    job = PipelineJob(job_id="test1", filename="test.pdf")
    assert job.job_id == "test1"
    assert job.filename == "test.pdf"
    assert job.status == "queued"
    assert len(job.steps) == len(PIPELINE_STEPS)
    for step_name in PIPELINE_STEPS:
        assert step_name in job.steps
        assert job.steps[step_name].status == "pending"


def test_pipeline_job_to_dict():
    """to_dict() should return a serializable dictionary."""
    job = PipelineJob(job_id="test2", filename="invoice.xlsx")
    d = job.to_dict()
    assert d["job_id"] == "test2"
    assert d["filename"] == "invoice.xlsx"
    assert d["status"] == "queued"
    assert isinstance(d["steps"], dict)
    assert "ingest" in d["steps"]
    assert d["steps"]["ingest"]["status"] == "pending"


def test_pipeline_job_step_update():
    """Steps can be updated individually."""
    job = PipelineJob(job_id="test3", filename="doc.pdf")
    job.steps["ingest"].status = "running"
    assert job.steps["ingest"].status == "running"
    assert job.steps["ontology"].status == "pending"

    job.steps["ingest"].status = "success"
    job.steps["ingest"].duration_ms = 1500
    d = job.to_dict()
    assert d["steps"]["ingest"]["status"] == "success"
    assert d["steps"]["ingest"]["duration_ms"] == 1500


def test_pipeline_job_with_error():
    """Jobs can track errors."""
    job = PipelineJob(job_id="err1", filename="bad.pdf")
    job.status = "failed"
    job.error = "File corrupt"
    d = job.to_dict()
    assert d["status"] == "failed"
    assert d["error"] == "File corrupt"


def test_pipeline_job_document_id():
    """Jobs track the document_id from ingest."""
    job = PipelineJob(job_id="doc1", filename="report.pdf")
    job.document_id = "report"
    d = job.to_dict()
    assert d["document_id"] == "report"


# ── StepResult Tests ─────────────────────────────────────────────────────────

def test_step_result_defaults():
    """StepResult defaults to pending status."""
    step = StepResult(step="ingest")
    assert step.status == "pending"
    assert step.started_at is None
    assert step.completed_at is None
    assert step.duration_ms is None
    assert step.detail is None
    assert step.error is None


def test_step_result_with_detail():
    """StepResult can store detail and error."""
    step = StepResult(
        step="schema",
        status="success",
        detail={"table_count": 8},
        duration_ms=234,
    )
    assert step.detail["table_count"] == 8
    assert step.duration_ms == 234


# ── Pipeline Steps ───────────────────────────────────────────────────────────

def test_pipeline_steps_order():
    """Pipeline steps should be in the correct execution order."""
    assert PIPELINE_STEPS == [
        "ingest", "ontology", "schema",
        "database_create", "data_load", "embed",
    ]


def test_pipeline_steps_count():
    """Should have exactly 6 pipeline steps."""
    assert len(PIPELINE_STEPS) == 6


# ── JobStatus Enum ───────────────────────────────────────────────────────────

def test_job_status_values():
    """JobStatus should have all expected values."""
    assert JobStatus.QUEUED == "queued"
    assert JobStatus.RUNNING == "running"
    assert JobStatus.COMPLETED == "completed"
    assert JobStatus.FAILED == "failed"
    assert JobStatus.PARTIAL == "partial"


# ── Job Store Tests ──────────────────────────────────────────────────────────

def test_get_job_not_found():
    """get_job returns None for unknown job_id."""
    assert get_job("nonexistent") is None


def test_get_job_found():
    """get_job returns the job if it exists."""
    job = PipelineJob(job_id="find1", filename="test.pdf")
    with _lock:
        _jobs["find1"] = job
    found = get_job("find1")
    assert found is not None
    assert found.job_id == "find1"


def test_list_jobs_empty():
    """list_jobs returns empty list when no jobs exist."""
    result = list_jobs()
    assert result == []


def test_list_jobs_returns_dicts():
    """list_jobs returns serialized dicts, not PipelineJob objects."""
    job = PipelineJob(job_id="list1", filename="a.pdf")
    with _lock:
        _jobs["list1"] = job
    result = list_jobs()
    assert len(result) == 1
    assert isinstance(result[0], dict)
    assert result[0]["job_id"] == "list1"


def test_list_jobs_limit():
    """list_jobs respects the limit parameter."""
    for i in range(5):
        with _lock:
            _jobs[f"lim{i}"] = PipelineJob(job_id=f"lim{i}", filename=f"{i}.pdf")
    result = list_jobs(limit=3)
    assert len(result) == 3


def test_list_jobs_newest_first():
    """list_jobs returns newest jobs first."""
    import time
    for i in range(3):
        with _lock:
            job = PipelineJob(job_id=f"ord{i}", filename=f"{i}.pdf")
            # Manually set created_at to ensure ordering
            job.created_at = f"2026-03-{20+i}T00:00:00+00:00"
            _jobs[f"ord{i}"] = job
    result = list_jobs()
    assert result[0]["job_id"] == "ord2"  # newest
    assert result[2]["job_id"] == "ord0"  # oldest


# ── Summarize Result Helper ──────────────────────────────────────────────────

def test_summarize_result_basic():
    """_summarize_result extracts known keys."""
    result = {
        "status": "ok",
        "count": 42,
        "tables": [{"name": "vendor"}, {"name": "customer"}],
        "extra_large_field": "x" * 10000,
    }
    summary = _summarize_result(result)
    assert summary["status"] == "ok"
    assert summary["count"] == 42
    assert summary["table_count"] == 2
    assert "extra_large_field" not in summary


def test_summarize_result_empty():
    """_summarize_result handles empty dict."""
    assert _summarize_result({}) == {}


def test_summarize_result_documents():
    """_summarize_result preserves document names."""
    result = {"documents": ["invoice.pdf", "contract.docx"]}
    summary = _summarize_result(result)
    assert summary["documents"] == ["invoice.pdf", "contract.docx"]


# ── API Endpoint Tests ───────────────────────────────────────────────────────

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from api import app

client = TestClient(app)


def test_pipeline_status_not_found():
    """GET /pipeline/status/{id} returns 404 for unknown job."""
    res = client.get("/pipeline/status/nonexistent")
    assert res.status_code == 404


def test_pipeline_jobs_empty():
    """GET /pipeline/jobs returns empty list initially."""
    res = client.get("/pipeline/jobs")
    assert res.status_code == 200
    data = res.json()
    assert "jobs" in data
    assert isinstance(data["jobs"], list)


def test_pipeline_run_unsupported_type():
    """POST /pipeline/run rejects unsupported file types."""
    from io import BytesIO
    res = client.post(
        "/pipeline/run",
        files={"file": ("test.exe", BytesIO(b"binary"), "application/octet-stream")},
    )
    assert res.status_code == 415
