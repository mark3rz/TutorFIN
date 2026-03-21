"""
tests/test_schema_generator.py — Unit tests for Layer 3 schema generator.
No API key needed — tests use synthetic EntityRegistry data.

Tests cover:
  - Type inference (integers, decimals, dates, booleans, varchar, text)
  - Column name sanitization
  - Schema generation (single/multiple tables, UNKNOWN skipping, nullable)
  - FK generation with canonical_name references (not id)
  - DDL output (IF NOT EXISTS, reserved word quoting, UNIQUE, indexes, DEFAULT)
  - Topological sort (parents before children)
"""

from pipeline.ontology.schema import (
    EntityRegistry, OntologyRecord, OntologyType, MappingConfidence,
)
from pipeline.schema_generator import (
    infer_sql_type,
    generate_schema,
    schema_to_ddl,
    _sanitize_column_name,
    _topological_sort,
    _quote_identifier,
    SQL_RESERVED_WORDS,
)


def _make_record(
    id: str,
    ont_type: OntologyType,
    name: str,
    attributes: dict,
    source: str = "test.pdf",
) -> OntologyRecord:
    return OntologyRecord(
        id=id,
        ontology_type=ont_type,
        confidence=MappingConfidence.HIGH,
        canonical_name=name,
        source_file=source,
        source_entity_type="test",
        attributes=attributes,
    )


def _build_registry(*records: OntologyRecord) -> EntityRegistry:
    reg = EntityRegistry()
    for r in records:
        reg.upsert(r)
    return reg


# ── infer_sql_type ───────────────────────────────────────────────────────────

def test_infer_type_integer():
    assert infer_sql_type(["42", "100", "-7"]) == "BIGINT"


def test_infer_type_decimal():
    assert infer_sql_type(["$1,234.56", "99.99", "$0.50"]) == "DECIMAL(18,2)"


def test_infer_type_date():
    assert infer_sql_type(["2024-01-15", "2023-12-01"]) == "DATE"


def test_infer_type_boolean():
    assert infer_sql_type(["true", "false", "True"]) == "BOOLEAN"


def test_infer_type_varchar_fallback():
    assert infer_sql_type(["hello", "world"]) == "VARCHAR(255)"


def test_infer_type_text_for_long_values():
    long_val = "x" * 300
    assert infer_sql_type([long_val]) == "TEXT"


def test_infer_type_empty_values():
    assert infer_sql_type([None, "", None]) == "VARCHAR(255)"


# ── _sanitize_column_name ────────────────────────────────────────────────────

def test_sanitize_column_basic():
    assert _sanitize_column_name("vendor_id") == "vendor_id"


def test_sanitize_column_special_chars():
    assert _sanitize_column_name("Payment Terms (days)") == "payment_terms_days"


def test_sanitize_column_leading_digit():
    assert _sanitize_column_name("1st_quarter") == "col_1st_quarter"


# ── _quote_identifier ───────────────────────────────────────────────────────

def test_quote_reserved_word():
    """Reserved words like 'transaction' should be double-quoted."""
    assert _quote_identifier("transaction") == '"transaction"'
    assert _quote_identifier("TRANSACTION") == '"transaction"'
    assert _quote_identifier("type") == '"type"'
    assert _quote_identifier("table") == '"table"'
    assert _quote_identifier("user") == '"user"'


def test_quote_non_reserved_word():
    """Non-reserved words should pass through lowercased."""
    assert _quote_identifier("vendor") == "vendor"
    assert _quote_identifier("customer") == "customer"
    assert _quote_identifier("employee") == "employee"
    assert _quote_identifier("canonical_name") == "canonical_name"


# ── generate_schema ─────────────────────────────────────────────────────────

def test_generate_schema_single_table():
    registry = _build_registry(
        _make_record("v1", OntologyType.VENDOR, "Acme Corp", {
            "vendor_id": "V001",
            "legal_name": "Acme Corporation",
            "payment_terms": "Net 30",
        }),
    )
    schema = generate_schema(registry)

    assert schema["version"] == "2.0"
    # portfolio_company system table + vendor = 2 tables
    assert len(schema["tables"]) == 2

    # portfolio_company should come first (parent)
    assert schema["tables"][0]["table_name"] == "portfolio_company"

    table = [t for t in schema["tables"] if t["table_name"] == "vendor"][0]
    assert table["record_count"] == 1

    col_names = [c["name"] for c in table["columns"]]
    assert "id" in col_names
    assert "canonical_name" in col_names
    assert "company_id" in col_names
    assert "vendor_id" in col_names
    assert "legal_name" in col_names
    assert "payment_terms" in col_names
    assert "created_at" in col_names
    assert "updated_at" in col_names


def test_generate_schema_multiple_tables():
    registry = _build_registry(
        _make_record("v1", OntologyType.VENDOR, "Acme Corp", {"vendor_id": "V001"}),
        _make_record("c1", OntologyType.CUSTOMER, "Beta LLC", {"customer_id": "C001"}),
        _make_record("t1", OntologyType.TRANSACTION, "Invoice #1234", {
            "transaction_id": "T001",
            "amount": "$5,000.00",
            "vendor_id": "V001",
        }),
    )
    schema = generate_schema(registry)

    # 3 entity tables + portfolio_company = 4
    assert len(schema["tables"]) == 4
    table_names = [t["table_name"] for t in schema["tables"]]
    assert "portfolio_company" in table_names
    assert "vendor" in table_names
    assert "customer" in table_names
    assert "transaction" in table_names


def test_generate_schema_skips_unknown():
    registry = _build_registry(
        _make_record("u1", OntologyType.UNKNOWN, "Mystery", {"foo": "bar"}),
        _make_record("v1", OntologyType.VENDOR, "Acme", {"vendor_id": "V001"}),
    )
    schema = generate_schema(registry)

    # portfolio_company + vendor = 2 (unknown is skipped)
    assert len(schema["tables"]) == 2
    table_names = [t["table_name"] for t in schema["tables"]]
    assert "vendor" in table_names
    assert "portfolio_company" in table_names


def test_generate_schema_nullable_columns():
    """Columns appearing in <50% of records should be nullable."""
    registry = _build_registry(
        _make_record("v1", OntologyType.VENDOR, "Acme", {
            "vendor_id": "V001",
            "legal_name": "Acme Corp",
            "category": "Supplier",
        }),
        _make_record("v2", OntologyType.VENDOR, "Beta", {
            "vendor_id": "V002",
            "legal_name": "Beta Inc",
        }),
        _make_record("v3", OntologyType.VENDOR, "Gamma", {
            "vendor_id": "V003",
            "legal_name": "Gamma LLC",
        }),
    )
    schema = generate_schema(registry)
    table = [t for t in schema["tables"] if t["table_name"] == "vendor"][0]
    col_map = {c["name"]: c for c in table["columns"]}

    # vendor_id and legal_name appear in 3/3 records → not nullable
    assert col_map["vendor_id"]["nullable"] is False
    assert col_map["legal_name"]["nullable"] is False
    # category appears in 1/3 records → nullable
    assert col_map["category"]["nullable"] is True


def test_generate_schema_foreign_keys_reference_canonical_name():
    """FK columns should reference canonical_name on the parent, not id."""
    registry = _build_registry(
        _make_record("v1", OntologyType.VENDOR, "Acme", {"vendor_id": "V001"}),
        _make_record("t1", OntologyType.TRANSACTION, "Invoice", {
            "transaction_id": "T001",
            "vendor_id": "V001",
            "amount": "$100",
        }),
    )
    schema = generate_schema(registry)
    tx_table = [t for t in schema["tables"] if t["table_name"] == "transaction"][0]

    # Phase 5: vendor_id FK + company_id FK = 2 FKs
    vendor_fk = [fk for fk in tx_table["foreign_keys"] if fk["column"] == "vendor_id"]
    assert len(vendor_fk) == 1
    assert vendor_fk[0]["references_table"] == "vendor"
    assert vendor_fk[0]["references_column"] == "canonical_name"

    # company_id FK should reference portfolio_company.id
    company_fk = [fk for fk in tx_table["foreign_keys"] if fk["column"] == "company_id"]
    assert len(company_fk) == 1
    assert company_fk[0]["references_table"] == "portfolio_company"
    assert company_fk[0]["references_column"] == "id"


def test_generate_schema_has_indexes():
    """Each table should have indexes for canonical_name+company_id and FK columns."""
    registry = _build_registry(
        _make_record("v1", OntologyType.VENDOR, "Acme", {"vendor_id": "V001"}),
        _make_record("t1", OntologyType.TRANSACTION, "Invoice", {
            "transaction_id": "T001",
            "vendor_id": "V001",
        }),
    )
    schema = generate_schema(registry)

    vendor_table = [t for t in schema["tables"] if t["table_name"] == "vendor"][0]
    tx_table = [t for t in schema["tables"] if t["table_name"] == "transaction"][0]

    # Vendor should have a composite unique index on (canonical_name, company_id)
    vendor_idx = vendor_table["indexes"]
    assert any(
        idx["columns"] == ["canonical_name", "company_id"] and idx["unique"]
        for idx in vendor_idx
    )
    # Vendor should have a company_id index
    assert any(idx["columns"] == ["company_id"] for idx in vendor_idx)

    # Transaction should have canonical_name+company_id composite index + vendor_id FK index
    tx_idx = tx_table["indexes"]
    assert any(
        idx["columns"] == ["canonical_name", "company_id"] and idx["unique"]
        for idx in tx_idx
    )
    assert any(idx["columns"] == ["vendor_id"] for idx in tx_idx)


def test_generate_schema_canonical_name_composite_unique():
    """Phase 5: canonical_name uniqueness is via composite index, not column-level UNIQUE."""
    registry = _build_registry(
        _make_record("v1", OntologyType.VENDOR, "Acme", {"vendor_id": "V001"}),
    )
    schema = generate_schema(registry)
    table = [t for t in schema["tables"] if t["table_name"] == "vendor"][0]
    cn_col = [c for c in table["columns"] if c["name"] == "canonical_name"][0]
    # No column-level unique — uniqueness is enforced by the composite functional index
    assert cn_col.get("unique") is not True

    # Composite unique index should exist
    assert any(
        idx["columns"] == ["canonical_name", "company_id"] and idx["unique"]
        for idx in table["indexes"]
    )


def test_generate_schema_audit_columns_have_defaults():
    """created_at and updated_at should have DEFAULT NOW()."""
    registry = _build_registry(
        _make_record("v1", OntologyType.VENDOR, "Acme", {"vendor_id": "V001"}),
    )
    schema = generate_schema(registry)
    table = [t for t in schema["tables"] if t["table_name"] == "vendor"][0]
    col_map = {c["name"]: c for c in table["columns"]}
    assert col_map["created_at"].get("default") == "NOW()"
    assert col_map["updated_at"].get("default") == "NOW()"


# ── Topological sort ────────────────────────────────────────────────────────

def test_topological_sort_parents_before_children():
    """Parent tables (referenced by FKs) should appear before children."""
    registry = _build_registry(
        _make_record("v1", OntologyType.VENDOR, "Acme", {"vendor_id": "V001"}),
        _make_record("c1", OntologyType.CUSTOMER, "Beta", {"customer_id": "C001"}),
        _make_record("t1", OntologyType.TRANSACTION, "Invoice", {
            "transaction_id": "T001",
            "vendor_id": "V001",
            "customer_id": "C001",
        }),
    )
    schema = generate_schema(registry)
    table_names = [t["table_name"] for t in schema["tables"]]

    # portfolio_company should be first (referenced by all entity tables)
    assert table_names[0] == "portfolio_company"
    # vendor and customer should come before transaction
    assert table_names.index("vendor") < table_names.index("transaction")
    assert table_names.index("customer") < table_names.index("transaction")


def test_topological_sort_deep_chain():
    """Multi-level dependencies should be properly ordered."""
    # portfolio_company → vendor → product (vendor_id FK) → transaction (product_id FK)
    registry = _build_registry(
        _make_record("v1", OntologyType.VENDOR, "Acme", {"vendor_id": "V001"}),
        _make_record("p1", OntologyType.PRODUCT, "Widget", {
            "product_id": "P001",
            "vendor_id": "V001",
        }),
        _make_record("t1", OntologyType.TRANSACTION, "Sale", {
            "transaction_id": "T001",
            "product_id": "P001",
            "vendor_id": "V001",
        }),
    )
    schema = generate_schema(registry)
    table_names = [t["table_name"] for t in schema["tables"]]

    assert table_names.index("portfolio_company") < table_names.index("vendor")
    assert table_names.index("vendor") < table_names.index("product")
    assert table_names.index("vendor") < table_names.index("transaction")
    assert table_names.index("product") < table_names.index("transaction")


def test_topological_sort_no_fks():
    """Tables with no FK relationships should still be included."""
    tables = [
        {"table_name": "vendor", "foreign_keys": []},
        {"table_name": "employee", "foreign_keys": []},
    ]
    sorted_tables = _topological_sort(tables)
    assert len(sorted_tables) == 2
    names = [t["table_name"] for t in sorted_tables]
    assert "vendor" in names
    assert "employee" in names


# ── schema_to_ddl ───────────────────────────────────────────────────────────

def test_ddl_uses_if_not_exists():
    """DDL should use CREATE TABLE IF NOT EXISTS."""
    registry = _build_registry(
        _make_record("v1", OntologyType.VENDOR, "Acme", {"vendor_id": "V001"}),
    )
    schema = generate_schema(registry)
    ddl = schema_to_ddl(schema)

    assert "CREATE TABLE IF NOT EXISTS" in ddl


def test_ddl_quotes_reserved_word_table_names():
    """Tables with reserved word names should be double-quoted in DDL."""
    registry = _build_registry(
        _make_record("t1", OntologyType.TRANSACTION, "Invoice", {
            "transaction_id": "T001",
            "amount": "$100",
        }),
    )
    schema = generate_schema(registry)
    ddl = schema_to_ddl(schema)

    # "transaction" is a reserved word — should be quoted
    assert 'CREATE TABLE IF NOT EXISTS "transaction"' in ddl


def test_ddl_has_composite_unique_index():
    """Phase 5: DDL should include composite unique index on (canonical_name, company_id)."""
    registry = _build_registry(
        _make_record("v1", OntologyType.VENDOR, "Acme", {"vendor_id": "V001"}),
    )
    schema = generate_schema(registry)
    ddl = schema_to_ddl(schema)

    # canonical_name should NOT have column-level UNIQUE (composite index handles this)
    assert "canonical_name VARCHAR(255) NOT NULL" in ddl
    # Composite functional index for uniqueness
    assert "idx_vendor_canonical_company" in ddl
    assert "COALESCE(company_id, -1)" in ddl


def test_ddl_has_default_now():
    """DDL should include DEFAULT NOW() on timestamp columns."""
    registry = _build_registry(
        _make_record("v1", OntologyType.VENDOR, "Acme", {"vendor_id": "V001"}),
    )
    schema = generate_schema(registry)
    ddl = schema_to_ddl(schema)

    assert "DEFAULT NOW()" in ddl


def test_ddl_fk_references_canonical_name():
    """FK constraints should reference canonical_name, not id."""
    registry = _build_registry(
        _make_record("v1", OntologyType.VENDOR, "Acme", {"vendor_id": "V001"}),
        _make_record("t1", OntologyType.TRANSACTION, "Invoice", {
            "transaction_id": "T001",
            "vendor_id": "V001",
        }),
    )
    schema = generate_schema(registry)
    ddl = schema_to_ddl(schema)

    assert "REFERENCES vendor(canonical_name)" in ddl


def test_ddl_includes_indexes():
    """DDL should include CREATE INDEX statements."""
    registry = _build_registry(
        _make_record("v1", OntologyType.VENDOR, "Acme", {"vendor_id": "V001"}),
        _make_record("t1", OntologyType.TRANSACTION, "Invoice", {
            "transaction_id": "T001",
            "vendor_id": "V001",
        }),
    )
    schema = generate_schema(registry)
    ddl = schema_to_ddl(schema)

    assert "CREATE UNIQUE INDEX IF NOT EXISTS" in ddl
    assert "CREATE INDEX IF NOT EXISTS" in ddl
    # Phase 5: composite unique + company_id + FK indexes
    assert "idx_vendor_canonical_company" in ddl
    assert "idx_vendor_company_id" in ddl
    assert "idx_transaction_vendor_id" in ddl


def test_ddl_header_comment():
    schema = generate_schema(EntityRegistry())
    ddl = schema_to_ddl(schema)
    assert "DataArch.AI" in ddl
    assert "Auto-generated" in ddl
    # Even empty registry should have portfolio_company table
    assert "portfolio_company" in ddl


def test_ddl_output_is_valid_sql():
    """Full DDL should contain all expected elements."""
    registry = _build_registry(
        _make_record("v1", OntologyType.VENDOR, "Acme", {
            "vendor_id": "V001",
            "payment_terms": "Net 30",
        }),
    )
    schema = generate_schema(registry)
    ddl = schema_to_ddl(schema)

    # portfolio_company system table
    assert "CREATE TABLE IF NOT EXISTS portfolio_company" in ddl
    # vendor entity table
    assert "CREATE TABLE IF NOT EXISTS vendor" in ddl
    assert "PRIMARY KEY" in ddl
    assert "canonical_name" in ddl
    assert "company_id" in ddl
    assert "vendor_id" in ddl
    assert "payment_terms" in ddl
    assert "created_at" in ddl


def test_ddl_includes_foreign_keys():
    registry = _build_registry(
        _make_record("v1", OntologyType.VENDOR, "Acme", {"vendor_id": "V001"}),
        _make_record("t1", OntologyType.TRANSACTION, "Invoice", {
            "transaction_id": "T001",
            "vendor_id": "V001",
        }),
    )
    schema = generate_schema(registry)
    ddl = schema_to_ddl(schema)

    assert "FOREIGN KEY (vendor_id) REFERENCES vendor(canonical_name)" in ddl
    # Phase 5: company_id FK to portfolio_company
    assert "FOREIGN KEY (company_id) REFERENCES portfolio_company(id)" in ddl
