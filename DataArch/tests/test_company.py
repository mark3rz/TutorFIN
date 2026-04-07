"""
tests/test_company.py — Tests for the portfolio company model and helpers.

Phase 5, Step 5.1a
"""

import pytest
from datetime import date, datetime
from unittest.mock import MagicMock, patch

from pipeline.company import (
    PortfolioCompany,
    CompanyCreate,
    CompanyUpdate,
    _slugify,
    PORTFOLIO_COMPANY_DDL,
    PORTFOLIO_COMPANY_INDEXES,
)


# ── Slug Generation ────────────────────────────────────────────────────────

class TestSlugify:
    """Tests for the _slugify() function."""

    def test_basic_name(self):
        assert _slugify("Acme Corporation") == "acme-corporation"

    def test_ampersand_and_special_chars(self):
        assert _slugify("Smith & Sons LLC") == "smith-sons-llc"

    def test_unicode_normalization(self):
        """Unicode characters like Ü should be normalized to ASCII."""
        assert _slugify("Über Technologies") == "uber-technologies"

    def test_extra_whitespace(self):
        assert _slugify("  Hello   World  ") == "hello-world"

    def test_numbers_preserved(self):
        assert _slugify("Tech Corp 2024") == "tech-corp-2024"

    def test_all_special_chars(self):
        """All special chars should produce hyphens, collapsed into one."""
        assert _slugify("A!@#$%B") == "a-b"

    def test_empty_string(self):
        assert _slugify("") == "unnamed"

    def test_only_special_chars(self):
        assert _slugify("!!!") == "unnamed"

    def test_leading_trailing_hyphens_stripped(self):
        assert _slugify("-Hello-World-") == "hello-world"

    def test_consecutive_hyphens_collapsed(self):
        assert _slugify("Foo---Bar") == "foo-bar"

    def test_already_slug(self):
        assert _slugify("already-a-slug") == "already-a-slug"

    def test_mixed_case(self):
        assert _slugify("CamelCaseCompany") == "camelcasecompany"

    def test_parentheses(self):
        assert _slugify("Company (Holding)") == "company-holding"

    def test_dots_and_commas(self):
        assert _slugify("Inc., Ltd.") == "inc-ltd"


# ── Pydantic Models ───────────────────────────────────────────────────────

class TestPortfolioCompanyModel:
    """Tests for the PortfolioCompany Pydantic model."""

    def test_minimal_creation(self):
        company = PortfolioCompany(name="Test Corp", slug="test-corp")
        assert company.name == "Test Corp"
        assert company.slug == "test-corp"
        assert company.id is None
        assert company.status == "active"
        assert company.sector is None
        assert company.fund is None

    def test_full_creation(self):
        company = PortfolioCompany(
            id=1,
            name="Acme Inc",
            slug="acme-inc",
            sector="Technology",
            acquisition_date=date(2024, 1, 15),
            hold_period_years=5.0,
            fund="Fund III",
            status="active",
            notes="First acquisition in tech sector",
        )
        assert company.id == 1
        assert company.sector == "Technology"
        assert company.acquisition_date == date(2024, 1, 15)
        assert company.hold_period_years == 5.0
        assert company.fund == "Fund III"

    def test_serialization(self):
        company = PortfolioCompany(
            name="Test",
            slug="test",
            acquisition_date=date(2024, 6, 1),
        )
        data = company.model_dump(mode="json")
        assert data["name"] == "Test"
        assert data["slug"] == "test"
        assert data["acquisition_date"] == "2024-06-01"

    def test_default_status(self):
        company = PortfolioCompany(name="X", slug="x")
        assert company.status == "active"

    def test_status_values(self):
        for status in ("active", "exited", "pending"):
            company = PortfolioCompany(name="X", slug="x", status=status)
            assert company.status == status


class TestCompanyCreate:
    """Tests for the CompanyCreate request model."""

    def test_minimal(self):
        req = CompanyCreate(name="New Company")
        assert req.name == "New Company"
        assert req.sector is None
        assert req.fund is None

    def test_full(self):
        req = CompanyCreate(
            name="Big Corp",
            sector="Healthcare",
            acquisition_date=date(2024, 3, 1),
            hold_period_years=7.5,
            fund="Fund IV",
            notes="Strategic acquisition",
        )
        assert req.sector == "Healthcare"
        assert req.hold_period_years == 7.5


class TestCompanyUpdate:
    """Tests for the CompanyUpdate request model."""

    def test_empty_update(self):
        req = CompanyUpdate()
        data = req.model_dump(exclude_none=True)
        assert data == {}

    def test_partial_update(self):
        req = CompanyUpdate(sector="FinTech", status="exited")
        data = req.model_dump(exclude_none=True)
        assert data == {"sector": "FinTech", "status": "exited"}

    def test_name_update(self):
        req = CompanyUpdate(name="New Name")
        data = req.model_dump(exclude_none=True)
        assert "name" in data


# ── DDL Validation ─────────────────────────────────────────────────────────

class TestPortfolioCompanyDDL:
    """Tests for the table DDL."""

    def test_ddl_has_if_not_exists(self):
        assert "IF NOT EXISTS" in PORTFOLIO_COMPANY_DDL

    def test_ddl_has_primary_key(self):
        assert "PRIMARY KEY" in PORTFOLIO_COMPANY_DDL

    def test_ddl_has_name_unique(self):
        assert "name VARCHAR(255) NOT NULL UNIQUE" in PORTFOLIO_COMPANY_DDL

    def test_ddl_has_slug_unique(self):
        assert "slug VARCHAR(100) NOT NULL UNIQUE" in PORTFOLIO_COMPANY_DDL

    def test_ddl_has_timestamps(self):
        assert "created_at TIMESTAMP NOT NULL DEFAULT NOW()" in PORTFOLIO_COMPANY_DDL
        assert "updated_at TIMESTAMP NOT NULL DEFAULT NOW()" in PORTFOLIO_COMPANY_DDL

    def test_ddl_has_all_columns(self):
        for col in ["sector", "acquisition_date", "hold_period_years", "fund", "status", "notes"]:
            assert col in PORTFOLIO_COMPANY_DDL

    def test_indexes_defined(self):
        assert len(PORTFOLIO_COMPANY_INDEXES) >= 2
        # Check slug index exists
        assert any("slug" in idx for idx in PORTFOLIO_COMPANY_INDEXES)

    def test_indexes_are_idempotent(self):
        for idx in PORTFOLIO_COMPANY_INDEXES:
            assert "IF NOT EXISTS" in idx


# ── OntologyRecord company_slug backward compat ──────────────────────────

class TestOntologyRecordCompanySlug:
    """Tests that the company_slug field on OntologyRecord is backward compatible."""

    def test_record_without_company_slug(self):
        """V1 records without company_slug should still work."""
        from pipeline.ontology.schema import OntologyRecord, OntologyType, MappingConfidence

        record = OntologyRecord(
            id="abc123",
            ontology_type=OntologyType.VENDOR,
            confidence=MappingConfidence.HIGH,
            canonical_name="Acme Corp",
            source_file="test.pdf",
            source_entity_type="vendor",
        )
        assert record.company_slug is None

    def test_record_with_company_slug(self):
        from pipeline.ontology.schema import OntologyRecord, OntologyType, MappingConfidence

        record = OntologyRecord(
            id="abc123",
            ontology_type=OntologyType.VENDOR,
            confidence=MappingConfidence.HIGH,
            canonical_name="Acme Corp",
            source_file="test.pdf",
            source_entity_type="vendor",
            company_slug="acme-corp",
        )
        assert record.company_slug == "acme-corp"

    def test_record_serialization_includes_company_slug(self):
        from pipeline.ontology.schema import OntologyRecord, OntologyType, MappingConfidence

        record = OntologyRecord(
            id="abc123",
            ontology_type=OntologyType.VENDOR,
            confidence=MappingConfidence.HIGH,
            canonical_name="Acme Corp",
            source_file="test.pdf",
            source_entity_type="vendor",
            company_slug="acme-corp",
        )
        data = record.model_dump(mode="json")
        assert data["company_slug"] == "acme-corp"

    def test_result_without_company_slug(self):
        from pipeline.ontology.schema import OntologyResult

        result = OntologyResult(source_file="test.pdf")
        assert result.company_slug is None

    def test_result_with_company_slug(self):
        from pipeline.ontology.schema import OntologyResult

        result = OntologyResult(source_file="test.pdf", company_slug="acme-corp")
        assert result.company_slug == "acme-corp"
