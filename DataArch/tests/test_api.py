"""
tests/test_api.py — API endpoint tests for DataArch.AI.
Tests all layers' endpoints using FastAPI TestClient.
No API key needed — tests only exercise endpoints that don't call the LLM.
"""

import json
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from api import app

client = TestClient(app)


# ── Health & Root ────────────────────────────────────────────────────────────

def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["product"] == "DataArch.AI"


def test_root_returns_html():
    res = client.get("/")
    assert res.status_code == 200
    assert "text/html" in res.headers["content-type"]
    assert "DataArch" in res.text


# ── Layer 1: Results listing ─────────────────────────────────────────────────

def test_list_results():
    res = client.get("/results")
    assert res.status_code == 200
    data = res.json()
    assert "count" in data
    assert "results" in data


def test_get_result_not_found():
    res = client.get("/results/nonexistent_document_xyz")
    assert res.status_code == 404


# ── Layer 2: Ontology ───────────────────────────────────────────────────────

def test_get_registry_empty():
    """Registry endpoint should return empty dict when no data exists."""
    res = client.get("/ontology/registry")
    assert res.status_code == 200
    data = res.json()
    assert "entries" in data


def test_ontology_result_not_found():
    res = client.get("/ontology/nonexistent_doc_xyz")
    assert res.status_code == 404


def test_ontology_map_not_found():
    res = client.post("/ontology/map/nonexistent_doc_xyz")
    assert res.status_code == 404


# ── Layer 3: Schema ─────────────────────────────────────────────────────────

def test_schema_not_generated_yet():
    """GET /schema should 404 if schema hasn't been generated."""
    # Only run if schema doesn't exist
    schema_path = Path("outputs/schema/schema.json")
    if not schema_path.exists():
        res = client.get("/schema")
        assert res.status_code == 404


def test_schema_sql_not_generated_yet():
    schema_path = Path("outputs/schema/schema.sql")
    if not schema_path.exists():
        res = client.get("/schema/sql")
        assert res.status_code == 404


# ── Layer 4: Data Flow ──────────────────────────────────────────────────────

def test_dataflow_not_generated_yet():
    """GET /dataflow should 404 if graph hasn't been generated."""
    df_path = Path("outputs/dataflow/dataflow.json")
    if not df_path.exists():
        res = client.get("/dataflow")
        assert res.status_code == 404


# ── Layer 5: Static files ───────────────────────────────────────────────────

def test_static_dataflow_html():
    res = client.get("/static/dataflow.html")
    assert res.status_code == 200
    assert "D3" in res.text or "d3" in res.text


def test_ingest_unsupported_type():
    """POST /ingest should reject unsupported file types."""
    from io import BytesIO
    res = client.post(
        "/ingest",
        files={"file": ("test.xyz", BytesIO(b"hello"), "application/octet-stream")},
    )
    assert res.status_code == 415
