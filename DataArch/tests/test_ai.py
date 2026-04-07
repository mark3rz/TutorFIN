"""
tests/test_ai.py — Unit tests for AI integration modules.
No API key, database, or Voyage AI key needed.
Tests exercise logic that doesn't call external services.
"""

import pytest

from pipeline.embeddings import entity_to_text
from pipeline.ai_analyst import (
    _format_schema_for_prompt,
    SQLGenerationResult,
    AnalyticsResponse,
    SQL_GENERATION_TOOL,
    ANSWER_TOOL,
)
from pipeline.ai_search import ENTITY_TABLES
from pipeline.ontology.schema import (
    OntologyRecord, OntologyType, MappingConfidence,
)


# ── entity_to_text ──────────────────────────────────────────────────────────

def _make_record(
    name: str,
    ont_type: OntologyType,
    attributes: dict | None = None,
    aliases: list | None = None,
    source: str = "test.pdf",
) -> OntologyRecord:
    return OntologyRecord(
        id="test123",
        ontology_type=ont_type,
        confidence=MappingConfidence.HIGH,
        canonical_name=name,
        aliases=aliases or [],
        source_file=source,
        source_entity_type="test",
        attributes=attributes or {},
    )


def test_entity_to_text_basic():
    record = _make_record("Acme Corp", OntologyType.VENDOR)
    text = entity_to_text(record)
    assert "Acme Corp" in text
    assert "vendor" in text


def test_entity_to_text_with_attributes():
    record = _make_record(
        "Acme Corp",
        OntologyType.VENDOR,
        attributes={"vendor_id": "V001", "payment_terms": "Net 30"},
    )
    text = entity_to_text(record)
    assert "vendor_id: V001" in text
    assert "payment_terms: Net 30" in text


def test_entity_to_text_with_aliases():
    record = _make_record(
        "Acme Corp",
        OntologyType.VENDOR,
        aliases=["ACME CORPORATION", "Acme"],
    )
    text = entity_to_text(record)
    assert "Also known as" in text
    assert "ACME CORPORATION" in text


def test_entity_to_text_with_source():
    record = _make_record("Acme Corp", OntologyType.VENDOR, source="invoice_2024.pdf")
    text = entity_to_text(record)
    assert "invoice_2024.pdf" in text


def test_entity_to_text_includes_type():
    record = _make_record("Q1 Revenue", OntologyType.FINANCIAL_RECORD)
    text = entity_to_text(record)
    assert "financial_record" in text


# ── _format_schema_for_prompt ───────────────────────────────────────────────

def test_format_schema_basic():
    schema = {
        "tables": [
            {
                "table_name": "vendor",
                "record_count": 5,
                "columns": [
                    {"name": "id", "type": "BIGSERIAL", "nullable": False, "primary_key": True},
                    {"name": "canonical_name", "type": "VARCHAR(255)", "nullable": False, "unique": True},
                    {"name": "vendor_id", "type": "VARCHAR(255)", "nullable": False},
                ],
                "foreign_keys": [],
            }
        ]
    }
    prompt = _format_schema_for_prompt(schema)
    assert "vendor" in prompt
    assert "BIGSERIAL" in prompt
    assert "canonical_name" in prompt
    assert "5 records" in prompt


def test_format_schema_with_fk():
    schema = {
        "tables": [
            {
                "table_name": "transaction",
                "record_count": 10,
                "columns": [
                    {"name": "id", "type": "BIGSERIAL", "nullable": False, "primary_key": True},
                    {"name": "vendor_id", "type": "VARCHAR(255)", "nullable": True},
                ],
                "foreign_keys": [
                    {"column": "vendor_id", "references_table": "vendor", "references_column": "canonical_name"},
                ],
            }
        ]
    }
    prompt = _format_schema_for_prompt(schema)
    assert "FK: vendor_id" in prompt
    assert "vendor.canonical_name" in prompt


def test_format_schema_empty():
    schema = {"tables": []}
    prompt = _format_schema_for_prompt(schema)
    assert "Database Schema" in prompt


# ── Tool schemas ────────────────────────────────────────────────────────────

def test_sql_generation_tool_schema():
    assert SQL_GENERATION_TOOL["name"] == "generate_sql_query"
    props = SQL_GENERATION_TOOL["input_schema"]["properties"]
    assert "sql" in props
    assert "explanation" in props
    assert SQL_GENERATION_TOOL["input_schema"]["required"] == ["sql", "explanation"]


def test_answer_tool_schema():
    assert ANSWER_TOOL["name"] == "provide_answer"
    props = ANSWER_TOOL["input_schema"]["properties"]
    assert "answer" in props


# ── Pydantic models ─────────────────────────────────────────────────────────

def test_sql_generation_result():
    result = SQLGenerationResult(
        sql="SELECT * FROM vendor",
        explanation="Lists all vendors",
    )
    assert result.sql == "SELECT * FROM vendor"
    assert result.explanation == "Lists all vendors"


def test_sql_generation_result_defaults():
    result = SQLGenerationResult(sql="SELECT 1")
    assert result.explanation == ""


def test_analytics_response():
    response = AnalyticsResponse(
        question="How many vendors?",
        sql="SELECT COUNT(*) FROM vendor",
        explanation="Counts vendors",
        columns=["count"],
        rows=[{"count": 5}],
        row_count=1,
        answer="There are 5 vendors.",
    )
    assert response.question == "How many vendors?"
    assert response.answer == "There are 5 vendors."
    assert response.row_count == 1


def test_analytics_response_defaults():
    response = AnalyticsResponse(question="test", sql="", explanation="")
    assert response.columns == []
    assert response.rows == []
    assert response.row_count == 0
    assert response.error is None


def test_analytics_response_with_error():
    response = AnalyticsResponse(
        question="bad question",
        sql="",
        explanation="",
        error="SQL generation failed",
    )
    assert response.error == "SQL generation failed"


# ── Entity tables list ─────────────────────────────────────────────────────

def test_entity_tables_coverage():
    """All 8 PE ontology types should be in the search tables list."""
    expected = [
        "vendor", "customer", "employee", "product",
        "transaction", "contract", "financial_record", "business_unit",
    ]
    for table in expected:
        assert table in ENTITY_TABLES, f"Missing entity table: {table}"


# ── API endpoint tests (via test client) ────────────────────────────────────

from fastapi.testclient import TestClient
from api import app

client = TestClient(app)


def test_ai_search_missing_query(auth_headers):
    response = client.post("/ai/search", json={}, headers=auth_headers)
    assert response.status_code == 400
    assert "query" in response.json()["detail"].lower()


def test_ai_ask_missing_question(auth_headers):
    response = client.post("/ai/ask", json={}, headers=auth_headers)
    assert response.status_code == 400
    assert "question" in response.json()["detail"].lower()
