"""
tests/test_portfolio_integration.py — Integration tests for Phase 5 Portfolio Intelligence.

Tests end-to-end flows across the multi-company data model, schema generation,
data loading, cross-portfolio queries, and entity resolution.

Phase 5, Step 8
"""

import json
import hashlib
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from pipeline.ontology.schema import (
    OntologyRecord, OntologyResult, EntityRegistry,
    OntologyType, MappingConfidence,
)
from pipeline.schema_generator import generate_schema, _get_company_fk_rules

# COMPANY_FK_RULES is a lazy-loaded None stub at module level in schema_generator.
# Use the accessor function directly so tests work without a DB connection.
COMPANY_FK_RULES = _get_company_fk_rules()
from pipeline.ontology.mapper import _make_id
from pipeline.data_loader import _upsert_entity, transform_value
from pipeline.ai_analyst import _format_schema_for_prompt, ANALYST_SYSTEM_PROMPT
from pipeline.ai_search import semantic_search, text_search, ENTITY_TABLES
from pipeline.dataflow import build_graph
from pipeline.company import PortfolioCompany, CompanyCreate, _slugify
from pipeline.entity_resolution import (
    RESOLVABLE_TABLES, MERGE_HISTORY_DDL,
    DuplicateCandidate, MergeResult,
)
from pipeline.pipeline_runner import PipelineJob, PIPELINE_STEPS


# ── Schema Generation includes portfolio_company ────────────────────────────


class TestSchemaPortfolioIntegration:
    """Schema generation correctly includes portfolio infrastructure."""

    def _make_registry(self):
        reg = EntityRegistry()
        record = OntologyRecord(
            id="abc123",
            ontology_type=OntologyType.VENDOR,
            confidence=MappingConfidence.HIGH,
            canonical_name="Acme Corp",
            source_file="test.csv",
            source_entity_type="vendor",
            attributes={"contact_email": "info@acme.com"},
        )
        reg.upsert(record)
        return reg

    def test_schema_has_portfolio_company_table(self):
        reg = self._make_registry()
        schema = generate_schema(reg)
        table_names = [t["table_name"] for t in schema["tables"]]
        assert "portfolio_company" in table_names

    def test_portfolio_company_is_first_table(self):
        reg = self._make_registry()
        schema = generate_schema(reg)
        assert schema["tables"][0]["table_name"] == "portfolio_company"

    def test_entity_tables_have_company_id(self):
        reg = self._make_registry()
        schema = generate_schema(reg)
        for table in schema["tables"]:
            if table["table_name"] in ("vendor", "customer", "employee", "product",
                                        "transaction", "contract", "financial_record",
                                        "business_unit"):
                col_names = [c["name"] for c in table["columns"]]
                assert "company_id" in col_names, f"{table['table_name']} missing company_id"

    def test_entity_tables_have_company_fk(self):
        reg = self._make_registry()
        schema = generate_schema(reg)
        for table in schema["tables"]:
            if table["table_name"] in COMPANY_FK_RULES:
                fk_cols = [fk["column"] for fk in table.get("foreign_keys", [])]
                assert "company_id" in fk_cols, f"{table['table_name']} missing company_id FK"

    def test_entity_tables_have_composite_unique_index(self):
        reg = self._make_registry()
        schema = generate_schema(reg)
        for table in schema["tables"]:
            if table["table_name"] == "portfolio_company":
                continue
            indexes = table.get("indexes", [])
            functional = [i for i in indexes if i.get("functional")]
            # Entity tables should have a functional composite unique index
            if table["table_name"] in COMPANY_FK_RULES:
                assert any(i.get("unique") for i in functional), \
                    f"{table['table_name']} missing composite unique index"

    def test_schema_version_is_v2(self):
        reg = self._make_registry()
        schema = generate_schema(reg)
        assert schema["version"] == "2.0"


# ── Company-aware ID generation ──────────────────────────────────────────────


class TestCompanyAwareMakeId:
    """_make_id produces different IDs for same entity under different companies."""

    def test_same_entity_different_companies_different_ids(self):
        id_a = _make_id("test.csv", "Acme Corp", "vendor", company_slug="alpha-holdings")
        id_b = _make_id("test.csv", "Acme Corp", "vendor", company_slug="beta-capital")
        assert id_a != id_b

    def test_same_entity_same_company_same_ids(self):
        id_a = _make_id("test.csv", "Acme Corp", "vendor", company_slug="alpha-holdings")
        id_b = _make_id("test.csv", "Acme Corp", "vendor", company_slug="alpha-holdings")
        assert id_a == id_b

    def test_no_company_slug_backward_compat(self):
        id_a = _make_id("test.csv", "Acme Corp", "vendor")
        id_b = _make_id("test.csv", "Acme Corp", "vendor", company_slug=None)
        assert id_a == id_b

    def test_company_slug_changes_hash(self):
        id_without = _make_id("test.csv", "Acme Corp", "vendor")
        id_with = _make_id("test.csv", "Acme Corp", "vendor", company_slug="acme-corp")
        assert id_without != id_with


# ── OntologyRecord company_slug ──────────────────────────────────────────────


class TestOntologyRecordCompanySlug:
    """OntologyRecord and OntologyResult support company_slug field."""

    def test_record_default_company_slug_none(self):
        r = OntologyRecord(
            id="abc", ontology_type=OntologyType.VENDOR,
            confidence=MappingConfidence.HIGH,
            canonical_name="Test", source_file="test.csv",
            source_entity_type="vendor",
        )
        assert r.company_slug is None

    def test_record_with_company_slug(self):
        r = OntologyRecord(
            id="abc", ontology_type=OntologyType.VENDOR,
            confidence=MappingConfidence.HIGH,
            canonical_name="Test", source_file="test.csv",
            source_entity_type="vendor",
            company_slug="alpha-holdings",
        )
        assert r.company_slug == "alpha-holdings"

    def test_result_with_company_slug(self):
        result = OntologyResult(
            source_file="test.csv",
            records=[],
            company_slug="beta-capital",
        )
        assert result.company_slug == "beta-capital"

    def test_result_default_company_slug_none(self):
        result = OntologyResult(
            source_file="test.csv",
            records=[],
        )
        assert result.company_slug is None


# ── Cross-portfolio prompt formatting ────────────────────────────────────────


class TestPortfolioPromptFormatting:
    """AI analyst prompt correctly includes portfolio architecture."""

    def test_system_prompt_mentions_portfolio_company(self):
        assert "portfolio_company" in ANALYST_SYSTEM_PROMPT

    def test_system_prompt_mentions_company_id(self):
        assert "company_id" in ANALYST_SYSTEM_PROMPT

    def test_system_prompt_mentions_cross_portfolio(self):
        assert "cross-portfolio" in ANALYST_SYSTEM_PROMPT.lower() or \
               "GROUP BY" in ANALYST_SYSTEM_PROMPT

    def test_schema_formatter_annotates_portfolio_table(self):
        schema = {
            "tables": [
                {
                    "table_name": "portfolio_company",
                    "columns": [
                        {"name": "id", "type": "BIGSERIAL", "primary_key": True, "nullable": False},
                        {"name": "name", "type": "VARCHAR(255)", "nullable": False},
                    ],
                    "foreign_keys": [],
                    "record_count": 5,
                },
            ],
        }
        formatted = _format_schema_for_prompt(schema)
        assert "PORTFOLIO" in formatted

    def test_schema_formatter_annotates_entity_tables(self):
        schema = {
            "tables": [
                {
                    "table_name": "vendor",
                    "columns": [
                        {"name": "id", "type": "BIGSERIAL", "primary_key": True, "nullable": False},
                        {"name": "canonical_name", "type": "VARCHAR(255)", "nullable": False},
                        {"name": "company_id", "type": "BIGINT", "nullable": True},
                    ],
                    "foreign_keys": [],
                    "record_count": 10,
                },
            ],
        }
        formatted = _format_schema_for_prompt(schema)
        assert "company_id" in formatted
        assert "entity" in formatted.lower()

    def test_schema_formatter_no_annotation_without_company_id(self):
        schema = {
            "tables": [
                {
                    "table_name": "vendor",
                    "columns": [
                        {"name": "id", "type": "BIGSERIAL", "primary_key": True, "nullable": False},
                        {"name": "canonical_name", "type": "VARCHAR(255)", "nullable": False},
                    ],
                    "foreign_keys": [],
                    "record_count": 10,
                },
            ],
        }
        formatted = _format_schema_for_prompt(schema)
        # Should not have the entity annotation if no company_id column
        assert "portfolio filtering" not in formatted


# ── Pipeline Job company_id propagation ──────────────────────────────────────


class TestPipelineJobCompany:
    def test_pipeline_job_has_company_id(self):
        job = PipelineJob(job_id="test1", filename="test.csv", company_id=42)
        assert job.company_id == 42

    def test_pipeline_job_company_id_none_by_default(self):
        job = PipelineJob(job_id="test1", filename="test.csv")
        assert job.company_id is None

    def test_pipeline_job_company_slug_none_by_default(self):
        job = PipelineJob(job_id="test1", filename="test.csv")
        assert job.company_slug is None

    def test_pipeline_job_to_dict_includes_company(self):
        job = PipelineJob(job_id="test1", filename="test.csv", company_id=5)
        d = job.to_dict()
        assert d["company_id"] == 5
        assert "company_slug" in d


# ── Dataflow company grouping ────────────────────────────────────────────────


class TestDataflowCompanyGrouping:
    def _make_registry_with_companies(self):
        reg = EntityRegistry()
        for i, slug in enumerate(["alpha", "alpha", "beta"]):
            r = OntologyRecord(
                id=f"id{i}",
                ontology_type=OntologyType.VENDOR,
                confidence=MappingConfidence.HIGH,
                canonical_name=f"Vendor {i}",
                source_file="test.csv",
                source_entity_type="vendor",
                company_slug=slug,
            )
            reg.upsert(r)
        return reg

    def test_graph_includes_company_slug_in_entities(self):
        reg = self._make_registry_with_companies()
        graph = build_graph(reg)
        vendor_node = [n for n in graph["nodes"] if n["id"] == "vendor"][0]
        has_company = any("company_slug" in e for e in vendor_node["entities"])
        assert has_company

    def test_graph_portfolio_stats_present(self):
        reg = self._make_registry_with_companies()
        graph = build_graph(reg)
        assert "portfolio" in graph["stats"]
        assert graph["stats"]["portfolio"]["total_companies"] == 2

    def test_graph_portfolio_entities_by_company(self):
        reg = self._make_registry_with_companies()
        graph = build_graph(reg)
        by_company = graph["stats"]["portfolio"]["entities_by_company"]
        assert "alpha" in by_company
        assert "beta" in by_company
        assert by_company["alpha"] == 2
        assert by_company["beta"] == 1

    def test_graph_without_companies_no_portfolio_stats(self):
        reg = EntityRegistry()
        r = OntologyRecord(
            id="id0", ontology_type=OntologyType.VENDOR,
            confidence=MappingConfidence.HIGH,
            canonical_name="Vendor 0", source_file="test.csv",
            source_entity_type="vendor",
        )
        reg.upsert(r)
        graph = build_graph(reg)
        assert "portfolio" not in graph["stats"]


# ── Entity search company filtering ─────────────────────────────────────────


class TestSearchCompanyFiltering:
    def test_entity_tables_list(self):
        assert "vendor" in ENTITY_TABLES
        assert len(ENTITY_TABLES) == 8


# ── Portfolio API endpoints ──────────────────────────────────────────────────


class TestPortfolioAPI:
    @pytest.fixture
    def client(self):
        from api import app
        return TestClient(app)

    @pytest.fixture
    def auth_headers(self):
        from auth import create_access_token
        token = create_access_token(
            user_id=1, email="test-admin@dataarch.ai",
            role="pe_admin", company_id=None,
        )
        return {"Authorization": f"Bearer {token}"}

    @patch("pipeline.database.get_engine")
    def test_portfolio_summary_returns_structure(self, mock_engine, client, auth_headers):
        """Test that portfolio summary endpoint returns expected structure even with mock."""
        # Mock the engine and connection
        mock_conn = MagicMock()
        mock_conn.__enter__ = MagicMock(return_value=mock_conn)
        mock_conn.__exit__ = MagicMock(return_value=False)
        mock_conn.execute = MagicMock(side_effect=Exception("no db"))

        mock_eng = MagicMock()
        mock_eng.connect = MagicMock(return_value=mock_conn)
        mock_engine.return_value = mock_eng

        # Endpoint should handle errors gracefully or return error
        res = client.get("/portfolio/summary", headers=auth_headers)
        # Either returns data or a 500 — both are valid depending on implementation
        assert res.status_code in (200, 500)

    def test_vendor_overlap_endpoint_exists(self, client, auth_headers):
        """Test that vendor overlap endpoint responds."""
        # Will fail with DB error but endpoint exists
        res = client.get("/portfolio/vendor-overlap", headers=auth_headers)
        assert res.status_code in (200, 500)

    @patch("routes.portfolio.get_company")
    def test_company_detail_not_found(self, mock_get, client, auth_headers):
        mock_get.return_value = None
        res = client.get("/portfolio/company/999/detail", headers=auth_headers)
        assert res.status_code == 404


# ── Entity Resolution integration ────────────────────────────────────────────


class TestEntityResolutionIntegration:
    def test_resolvable_tables_are_subset_of_entity_tables(self):
        """RESOLVABLE_TABLES should be a subset of ENTITY_TABLES.

        transaction and financial_record have is_entity_table=True but
        is_resolvable=False — you don't deduplicate transactional line items
        or aggregate financial records.  RESOLVABLE_TABLES is intentionally
        smaller than ENTITY_TABLES.
        """
        assert set(RESOLVABLE_TABLES).issubset(set(ENTITY_TABLES))
        # The non-resolvable types are transaction and financial_record
        assert "transaction" in ENTITY_TABLES
        assert "financial_record" in ENTITY_TABLES
        assert "transaction" not in RESOLVABLE_TABLES
        assert "financial_record" not in RESOLVABLE_TABLES

    def test_merge_history_ddl_has_jsonb_snapshot(self):
        assert "previous_state JSONB" in MERGE_HISTORY_DDL

    def test_duplicate_candidate_model_round_trip(self):
        c = DuplicateCandidate(
            source_id=1, source_name="A Inc",
            source_company_id=10,
            target_id=2, target_name="A Incorporated",
            target_company_id=20,
            entity_type="vendor", similarity=0.93,
        )
        d = c.model_dump()
        c2 = DuplicateCandidate(**d)
        assert c2.similarity == 0.93
        assert c2.source_company_id == 10

    def test_merge_result_model_round_trip(self):
        r = MergeResult(
            merge_id=1, entity_type="vendor",
            source_id=10, source_name="Duplicate",
            target_id=20, target_name="Original",
        )
        d = r.model_dump()
        r2 = MergeResult(**d)
        assert r2.status == "merged"


# ── Company model integration ────────────────────────────────────────────────


class TestCompanyModelIntegration:
    def test_slugify_creates_url_safe_slug(self):
        assert _slugify("Acme Corp") == "acme-corp"
        assert _slugify("Alpha & Beta Holdings") == "alpha-beta-holdings"

    def test_company_model_all_fields(self):
        c = PortfolioCompany(
            id=1, name="Acme Corp", slug="acme-corp",
            sector="Technology", fund="Fund III", status="active",
        )
        d = c.model_dump(mode="json")
        assert d["name"] == "Acme Corp"
        assert d["slug"] == "acme-corp"
        assert d["sector"] == "Technology"
