"""
tests/test_entity_resolution.py — Tests for entity resolution (fuzzy dedup + merge).

Phase 5, Step 5.4
"""

import json
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from pipeline.entity_resolution import (
    DuplicateCandidate,
    MergeRequest,
    MergeResult,
    MergeHistoryEntry,
    MERGE_HISTORY_DDL,
    RESOLVABLE_TABLES,
    find_duplicate_candidates,
    merge_entities,
    undo_merge,
    get_merge_history,
    ensure_merge_history_table,
)


# ── Model Validation ─────────────────────────────────────────────────────────


class TestDuplicateCandidate:
    def test_basic_candidate(self):
        c = DuplicateCandidate(
            source_id=1, source_name="Acme Corp",
            target_id=2, target_name="ACME Corporation",
            entity_type="vendor", similarity=0.95,
        )
        assert c.source_name == "Acme Corp"
        assert c.target_name == "ACME Corporation"
        assert c.similarity == 0.95
        assert c.entity_type == "vendor"

    def test_candidate_with_company_ids(self):
        c = DuplicateCandidate(
            source_id=1, source_name="X",
            source_company_id=10,
            target_id=2, target_name="Y",
            target_company_id=20,
            entity_type="vendor", similarity=0.88,
        )
        assert c.source_company_id == 10
        assert c.target_company_id == 20

    def test_candidate_null_company_ids(self):
        c = DuplicateCandidate(
            source_id=1, source_name="X",
            target_id=2, target_name="Y",
            entity_type="customer", similarity=0.90,
        )
        assert c.source_company_id is None
        assert c.target_company_id is None

    def test_candidate_serialization(self):
        c = DuplicateCandidate(
            source_id=1, source_name="A",
            target_id=2, target_name="B",
            entity_type="vendor", similarity=0.92,
        )
        d = c.model_dump()
        assert d["source_id"] == 1
        assert d["similarity"] == 0.92
        assert "entity_type" in d


class TestMergeRequest:
    def test_basic_request(self):
        r = MergeRequest(source_id=1, target_id=2, entity_type="vendor")
        assert r.merged_by == "user"

    def test_custom_merged_by(self):
        r = MergeRequest(source_id=1, target_id=2, entity_type="vendor", merged_by="admin")
        assert r.merged_by == "admin"


class TestMergeResult:
    def test_basic_result(self):
        r = MergeResult(
            merge_id=1, entity_type="vendor",
            source_id=10, source_name="Acme",
            target_id=20, target_name="ACME Corp",
        )
        assert r.status == "merged"
        assert r.merge_id == 1

    def test_result_serialization(self):
        r = MergeResult(
            merge_id=1, entity_type="vendor",
            source_id=10, source_name="A",
            target_id=20, target_name="B",
        )
        d = r.model_dump()
        assert d["status"] == "merged"
        assert d["entity_type"] == "vendor"


class TestMergeHistoryEntry:
    def test_basic_entry(self):
        e = MergeHistoryEntry(
            id=1, entity_type="vendor",
            source_id=10, source_canonical_name="Acme",
            target_id=20, target_canonical_name="ACME Corp",
            merged_by="user", merged_at="2025-01-01T00:00:00",
        )
        assert e.undone_at is None
        assert e.similarity_score is None
        assert e.source_company_id is None

    def test_entry_with_all_fields(self):
        e = MergeHistoryEntry(
            id=1, entity_type="vendor",
            source_id=10, source_canonical_name="Acme",
            source_company_id=5,
            target_id=20, target_canonical_name="ACME Corp",
            target_company_id=5,
            similarity_score=0.95,
            merged_by="admin", merged_at="2025-01-01T00:00:00",
            undone_at="2025-01-02T00:00:00",
        )
        assert e.similarity_score == 0.95
        assert e.undone_at is not None


# ── Constants & DDL ──────────────────────────────────────────────────────────


class TestConstants:
    def test_resolvable_tables(self):
        assert "vendor" in RESOLVABLE_TABLES
        assert "customer" in RESOLVABLE_TABLES
        assert "employee" in RESOLVABLE_TABLES
        assert "product" in RESOLVABLE_TABLES
        assert "transaction" in RESOLVABLE_TABLES
        assert "contract" in RESOLVABLE_TABLES
        assert "financial_record" in RESOLVABLE_TABLES
        assert "business_unit" in RESOLVABLE_TABLES
        assert len(RESOLVABLE_TABLES) == 8

    def test_merge_history_ddl_structure(self):
        assert "CREATE TABLE IF NOT EXISTS entity_merge_history" in MERGE_HISTORY_DDL
        assert "source_id BIGINT" in MERGE_HISTORY_DDL
        assert "target_id BIGINT" in MERGE_HISTORY_DDL
        assert "previous_state JSONB" in MERGE_HISTORY_DDL
        assert "undone_at TIMESTAMP" in MERGE_HISTORY_DDL
        assert "merged_by VARCHAR(50)" in MERGE_HISTORY_DDL
        assert "similarity_score DECIMAL" in MERGE_HISTORY_DDL


# ── Function Validation ──────────────────────────────────────────────────────


class TestFindDuplicates:
    def test_invalid_entity_type(self):
        with pytest.raises(ValueError, match="Invalid entity_type"):
            find_duplicate_candidates("invalid_table")

    def test_invalid_entity_type_empty(self):
        with pytest.raises(ValueError, match="Invalid entity_type"):
            find_duplicate_candidates("")


class TestMergeEntities:
    def test_invalid_entity_type(self):
        with pytest.raises(ValueError, match="Invalid entity_type"):
            merge_entities(1, 2, "invalid_table")


# ── API Endpoint Tests ────────────────────────────────────────────────────────


class TestEntityResolutionAPI:
    @pytest.fixture
    def client(self):
        from api import app
        return TestClient(app)

    def test_find_duplicates_missing_entity_type(self, client):
        res = client.post("/entities/duplicates", json={})
        assert res.status_code == 400
        assert "entity_type" in res.json()["detail"]

    def test_merge_missing_fields(self, client):
        res = client.post("/entities/merge", json={"source_id": 1})
        assert res.status_code == 400
        assert "target_id" in res.json()["detail"] or "entity_type" in res.json()["detail"]

    def test_merge_undo_missing_merge_id(self, client):
        res = client.post("/entities/merge/undo", json={})
        assert res.status_code == 400
        assert "merge_id" in res.json()["detail"]

    @patch("pipeline.entity_resolution.get_engine")
    @patch("pipeline.entity_resolution.ensure_merge_history_table")
    def test_find_duplicates_invalid_type_via_api(self, mock_ensure, mock_engine, client):
        mock_ensure.return_value = {"status": "ok"}
        res = client.post("/entities/duplicates", json={"entity_type": "invalid"})
        assert res.status_code == 400

    @patch("pipeline.entity_resolution.get_engine")
    def test_merge_invalid_entity_type_via_api(self, mock_engine, client):
        res = client.post("/entities/merge", json={
            "source_id": 1, "target_id": 2, "entity_type": "invalid",
        })
        assert res.status_code == 400
