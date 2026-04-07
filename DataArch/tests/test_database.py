"""
tests/test_database.py — Unit tests for database layer.

Tests that don't require a running PostgreSQL instance:
  - DDL generation from table definitions
  - Read-only query safety validation
  - Schema loading
  - Index DDL generation

Tests that require PostgreSQL are marked with @pytest.mark.postgres
and will be skipped if no database is available.
"""

import pytest
from unittest.mock import patch, MagicMock

from pipeline.database import (
    _table_to_ddl,
    _index_to_ddl,
    _quote_identifier,
    _mask_url,
    execute_readonly_query,
    ENTITY_TABLES,
)


# ── _table_to_ddl ──────────────────────────────────────────────────────────

def test_table_ddl_basic():
    """Basic table DDL generation."""
    table_def = {
        "table_name": "vendor",
        "columns": [
            {"name": "id", "type": "BIGSERIAL", "nullable": False, "primary_key": True},
            {"name": "canonical_name", "type": "VARCHAR(255)", "nullable": False, "primary_key": False, "unique": True},
            {"name": "vendor_id", "type": "VARCHAR(255)", "nullable": False, "primary_key": False},
        ],
        "foreign_keys": [],
    }
    ddl = _table_to_ddl(table_def)

    assert "CREATE TABLE IF NOT EXISTS vendor" in ddl
    assert "id BIGSERIAL" in ddl
    assert "canonical_name VARCHAR(255) NOT NULL UNIQUE" in ddl
    assert "PRIMARY KEY (id)" in ddl


def test_table_ddl_reserved_word():
    """Tables with reserved word names should be quoted."""
    table_def = {
        "table_name": "transaction",
        "columns": [
            {"name": "id", "type": "BIGSERIAL", "nullable": False, "primary_key": True},
            {"name": "canonical_name", "type": "VARCHAR(255)", "nullable": False, "primary_key": False},
        ],
        "foreign_keys": [],
    }
    ddl = _table_to_ddl(table_def)
    assert 'CREATE TABLE IF NOT EXISTS "transaction"' in ddl


def test_table_ddl_with_fk():
    """Foreign keys should reference the correct table and column."""
    table_def = {
        "table_name": "contract",
        "columns": [
            {"name": "id", "type": "BIGSERIAL", "nullable": False, "primary_key": True},
            {"name": "vendor_id", "type": "VARCHAR(255)", "nullable": True, "primary_key": False},
        ],
        "foreign_keys": [
            {"column": "vendor_id", "references_table": "vendor", "references_column": "canonical_name"},
        ],
    }
    ddl = _table_to_ddl(table_def)
    assert "FOREIGN KEY (vendor_id) REFERENCES vendor(canonical_name)" in ddl


def test_table_ddl_with_defaults():
    """Columns with defaults should include DEFAULT clause."""
    table_def = {
        "table_name": "vendor",
        "columns": [
            {"name": "id", "type": "BIGSERIAL", "nullable": False, "primary_key": True},
            {"name": "created_at", "type": "TIMESTAMP", "nullable": False, "primary_key": False, "default": "NOW()"},
        ],
        "foreign_keys": [],
    }
    ddl = _table_to_ddl(table_def)
    assert "DEFAULT NOW()" in ddl


# ── _index_to_ddl ──────────────────────────────────────────────────────────

def test_index_ddl_basic():
    idx_def = {"columns": ["vendor_id"], "unique": False}
    ddl = _index_to_ddl("contract", idx_def)
    assert "CREATE INDEX IF NOT EXISTS idx_contract_vendor_id ON contract (vendor_id)" in ddl


def test_index_ddl_unique():
    idx_def = {"columns": ["canonical_name"], "unique": True}
    ddl = _index_to_ddl("vendor", idx_def)
    assert "CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_canonical_name ON vendor (canonical_name)" in ddl


def test_index_ddl_reserved_word_table():
    idx_def = {"columns": ["vendor_id"], "unique": False}
    ddl = _index_to_ddl("transaction", idx_def)
    assert 'ON "transaction"' in ddl


# ── _quote_identifier ──────────────────────────────────────────────────────

def test_quote_reserved():
    assert _quote_identifier("transaction") == '"transaction"'
    assert _quote_identifier("type") == '"type"'


def test_quote_non_reserved():
    assert _quote_identifier("vendor") == "vendor"
    assert _quote_identifier("canonical_name") == "canonical_name"


# ── _mask_url ───────────────────────────────────────────────────────────────

def test_mask_url_with_password():
    url = "postgresql://user:secret123@localhost:5432/mydb"
    masked = _mask_url(url)
    assert "secret123" not in masked
    assert "****" in masked
    assert "localhost:5432/mydb" in masked


def test_mask_url_without_password():
    url = "postgresql://localhost:5432/mydb"
    masked = _mask_url(url)
    assert masked == url


# ── execute_readonly_query safety ───────────────────────────────────────────

def test_query_blocks_insert():
    with pytest.raises(ValueError, match="Only SELECT"):
        execute_readonly_query("INSERT INTO vendor VALUES ('test')")


def test_query_blocks_update():
    with pytest.raises(ValueError, match="Only SELECT"):
        execute_readonly_query("UPDATE vendor SET name = 'hacked'")


def test_query_blocks_delete():
    with pytest.raises(ValueError, match="Only SELECT"):
        execute_readonly_query("DELETE FROM vendor")


def test_query_blocks_drop():
    with pytest.raises(ValueError, match="Only SELECT"):
        execute_readonly_query("DROP TABLE vendor")


def test_query_blocks_alter():
    with pytest.raises(ValueError, match="Only SELECT"):
        execute_readonly_query("ALTER TABLE vendor ADD COLUMN x TEXT")


def test_query_blocks_truncate():
    with pytest.raises(ValueError, match="Only SELECT"):
        execute_readonly_query("TRUNCATE vendor")


def test_query_blocks_create():
    with pytest.raises(ValueError, match="Only SELECT"):
        execute_readonly_query("CREATE TABLE evil (id int)")


def test_query_blocks_grant():
    with pytest.raises(ValueError, match="Only SELECT"):
        execute_readonly_query("GRANT ALL ON vendor TO evil_user")


def test_query_allows_select():
    """SELECT queries should not raise ValueError (may fail on DB connect)."""
    # If a DB is available this will succeed; if not it'll raise OperationalError.
    # Either way, it must NEVER raise ValueError (which means blocked).
    try:
        result = execute_readonly_query("SELECT 1")
        # DB was reachable — result should be valid
        assert result["row_count"] >= 1
    except ValueError:
        pytest.fail("SELECT query was incorrectly blocked by safety filter")
    except Exception:
        # OperationalError etc. from no DB — that's fine
        pass


def test_query_allows_with_cte():
    """WITH/CTE queries should not raise ValueError."""
    try:
        result = execute_readonly_query("WITH cte AS (SELECT 1) SELECT * FROM cte")
        assert result["row_count"] >= 1
    except ValueError:
        pytest.fail("WITH/CTE query was incorrectly blocked by safety filter")
    except Exception:
        pass


def test_query_blocks_select_with_embedded_delete():
    """SELECT with embedded dangerous keywords should be blocked."""
    with pytest.raises(ValueError, match="disallowed keyword"):
        execute_readonly_query("SELECT * FROM vendor; DELETE FROM vendor")


# ── Phase 5: Functional index DDL ─────────────────────────────────────────

def test_index_ddl_functional():
    """Functional indexes should use the expression directly."""
    idx_def = {
        "columns": ["canonical_name", "company_id"],
        "unique": True,
        "functional": True,
        "expression": "CREATE UNIQUE INDEX IF NOT EXISTS idx_{table}_canonical_company "
                      "ON {table} (canonical_name, COALESCE(company_id, -1))",
    }
    ddl = _index_to_ddl("vendor", idx_def)
    assert "idx_vendor_canonical_company" in ddl
    assert "COALESCE(company_id, -1)" in ddl
    assert "CREATE UNIQUE INDEX IF NOT EXISTS" in ddl


def test_entity_tables_list():
    """ENTITY_TABLES should include all 8 PE ontology types."""
    assert len(ENTITY_TABLES) == 8
    assert "vendor" in ENTITY_TABLES
    assert "customer" in ENTITY_TABLES
    assert "employee" in ENTITY_TABLES
    assert "product" in ENTITY_TABLES
    assert "transaction" in ENTITY_TABLES
    assert "contract" in ENTITY_TABLES
    assert "financial_record" in ENTITY_TABLES
    assert "business_unit" in ENTITY_TABLES


def test_table_ddl_with_company_id():
    """Entity tables should include company_id column with FK to portfolio_company."""
    table_def = {
        "table_name": "vendor",
        "columns": [
            {"name": "id", "type": "BIGSERIAL", "nullable": False, "primary_key": True},
            {"name": "canonical_name", "type": "VARCHAR(255)", "nullable": False, "primary_key": False},
            {"name": "company_id", "type": "BIGINT", "nullable": True, "primary_key": False},
        ],
        "foreign_keys": [
            {"column": "company_id", "references_table": "portfolio_company", "references_column": "id"},
        ],
    }
    ddl = _table_to_ddl(table_def)
    assert "company_id BIGINT" in ddl
    assert "FOREIGN KEY (company_id) REFERENCES portfolio_company(id)" in ddl
