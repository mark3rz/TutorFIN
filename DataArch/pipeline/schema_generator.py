"""
pipeline/schema_generator.py — Layer 3: Schema Generator for DataArch.AI.

Reads the EntityRegistry from outputs/ontology/entity_registry.json and
produces a normalised PostgreSQL DDL schema. Each OntologyType becomes a table.
Column names are derived from the union of attributes seen across all records
of that type.

Output:
  outputs/schema/schema.sql  — PostgreSQL CREATE TABLE statements
  outputs/schema/schema.json — structured schema for the data flow map

Fixes (Phase 1.1):
  - Topological sort: parent tables created before children
  - FK type compatibility: FK columns reference canonical_name (VARCHAR) not id (BIGSERIAL)
  - Reserved words: table/column names are quoted when necessary
  - UNIQUE constraints on natural keys (canonical_name)
  - Indexes on FK columns and canonical_name
  - CREATE TABLE IF NOT EXISTS for idempotency
"""

from __future__ import annotations

import json
import re
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

from pipeline.ontology.schema import EntityRegistry, OntologyType

SCHEMA_OUTPUT_DIR = Path("outputs/schema")
REGISTRY_PATH = Path("outputs/ontology/entity_registry.json")

# ── SQL reserved words ───────────────────────────────────────────────────────

# PostgreSQL reserved words that must be double-quoted when used as identifiers.
# This is a subset of the most commonly conflicting ones in our PE domain.
SQL_RESERVED_WORDS = frozenset({
    "all", "analyse", "analyze", "and", "any", "array", "as", "asc",
    "authorization", "between", "binary", "both", "case", "cast", "check",
    "collate", "column", "constraint", "create", "cross", "current_date",
    "current_time", "current_timestamp", "default", "deferrable", "desc",
    "distinct", "do", "else", "end", "except", "false", "fetch", "for",
    "foreign", "from", "full", "grant", "group", "having", "in", "index",
    "initially", "inner", "insert", "intersect", "into", "is", "join",
    "lateral", "leading", "left", "like", "limit", "localtime", "natural",
    "new", "not", "null", "offset", "old", "on", "only", "or", "order",
    "outer", "overlaps", "placing", "primary", "references", "returning",
    "right", "select", "session_user", "set", "some", "symmetric", "table",
    "then", "to", "trailing", "transaction", "true", "type", "union",
    "unique", "update", "user", "using", "values", "when", "where", "window",
    "with",
})


def _quote_identifier(name: str) -> str:
    """
    Double-quote a SQL identifier if it's a reserved word.
    Always lowercases for consistency.
    """
    lower = name.lower()
    if lower in SQL_RESERVED_WORDS:
        return f'"{lower}"'
    return lower


# ── Column type inference ────────────────────────────────────────────────────

# Patterns for inferring SQL types from attribute values
_DATE_PATTERNS = [
    re.compile(r"^\d{4}-\d{2}-\d{2}"),                      # 2024-01-15
    re.compile(r"^\d{1,2}/\d{1,2}/\d{2,4}$"),               # 1/15/2024
    re.compile(r"^\d{1,2}-\w{3}-\d{2,4}$"),                  # 15-Jan-2024
]

_DECIMAL_PATTERN = re.compile(
    r"^[\$£€]?\s*-?\d{1,3}(?:[,_]\d{3})*(?:\.\d+)?$"        # $1,234.56
)

_INTEGER_PATTERN = re.compile(r"^-?\d+$")


def infer_sql_type(values: list[Any]) -> str:
    """
    Infer a PostgreSQL column type from a sample of attribute values.
    Falls back to VARCHAR(255) when uncertain.
    """
    # Ignore None / empty
    samples = [str(v).strip() for v in values if v is not None and str(v).strip()]
    if not samples:
        return "VARCHAR(255)"

    # Check booleans
    bool_vals = {"true", "false", "yes", "no", "1", "0"}
    if all(s.lower() in bool_vals for s in samples):
        return "BOOLEAN"

    # Check dates
    if all(any(p.match(s) for p in _DATE_PATTERNS) for s in samples):
        return "DATE"

    # Check integers (before decimal, since integers also match decimal without dot)
    if all(_INTEGER_PATTERN.match(s) for s in samples):
        # Use BIGINT for values that might be large IDs
        return "BIGINT"

    # Check decimals / currency
    if all(_DECIMAL_PATTERN.match(s) for s in samples):
        return "DECIMAL(18,2)"

    # Long text
    if any(len(s) > 255 for s in samples):
        return "TEXT"

    return "VARCHAR(255)"


# ── Foreign key relationships ────────────────────────────────────────────────

# Known FK relationships in the PE ontology
# (child_table, column_name) → parent_table
FK_RULES: dict[tuple[str, str], str] = {
    ("transaction", "vendor_id"):    "vendor",
    ("transaction", "customer_id"):  "customer",
    ("transaction", "product_id"):   "product",
    ("contract", "vendor_id"):       "vendor",
    ("contract", "customer_id"):     "customer",
    ("employee", "department"):      "business_unit",
    ("product", "vendor_id"):        "vendor",
}


# ── Topological sort ─────────────────────────────────────────────────────────

def _topological_sort(tables: list[dict]) -> list[dict]:
    """
    Sort tables so that parent tables (referenced by FKs) come before children.
    Uses Kahn's algorithm for deterministic ordering.
    """
    table_map = {t["table_name"]: t for t in tables}
    table_names = set(table_map.keys())

    # Build adjacency: child → set of parents
    # (edges go from child to parent, we need parents first)
    children_of: dict[str, set[str]] = defaultdict(set)  # parent → children
    parent_of: dict[str, set[str]] = defaultdict(set)    # child → parents

    for table in tables:
        for fk in table.get("foreign_keys", []):
            parent = fk["references_table"]
            child = table["table_name"]
            if parent in table_names and parent != child:
                children_of[parent].add(child)
                parent_of[child].add(parent)

    # Kahn's algorithm: start with tables that have no parents
    no_parents = sorted([t for t in table_names if not parent_of.get(t)])
    result = []
    visited = set()

    while no_parents:
        node = no_parents.pop(0)
        if node in visited:
            continue
        visited.add(node)
        result.append(table_map[node])

        for child in sorted(children_of.get(node, set())):
            parent_of[child].discard(node)
            if not parent_of[child] and child not in visited:
                no_parents.append(child)

    # Add any remaining tables (circular deps or orphans)
    for name in sorted(table_names - visited):
        result.append(table_map[name])

    return result


# ── Core generation logic ───────────────────────────────────────────────────

def _sanitize_column_name(name: str) -> str:
    """Convert an attribute key to a valid SQL column name."""
    col = name.lower().strip()
    col = re.sub(r"[^a-z0-9_]", "_", col)
    col = re.sub(r"_+", "_", col).strip("_")
    if not col or col[0].isdigit():
        col = f"col_{col}"
    return col


def _table_name(ont_type: OntologyType) -> str:
    """Convert OntologyType to a PostgreSQL table name."""
    return ont_type.value  # already snake_case: vendor, customer, etc.


def generate_schema(registry: EntityRegistry) -> dict:
    """
    Generate a structured schema from the EntityRegistry.

    Returns a dict with:
      - version: schema version string
      - generated_at: timestamp
      - tables: list of table definitions (topologically sorted)
    """
    # Group records by ontology type and collect all attribute values
    type_attrs: dict[str, dict[str, list[Any]]] = defaultdict(lambda: defaultdict(list))
    type_record_counts: dict[str, int] = defaultdict(int)

    for record in registry.entries.values():
        if record.ontology_type == OntologyType.UNKNOWN:
            continue
        table = _table_name(record.ontology_type)
        type_record_counts[table] += 1
        for attr_key, attr_val in record.attributes.items():
            type_attrs[table][attr_key].append(attr_val)

    tables = []
    for table_name in sorted(type_attrs.keys()):
        attrs = type_attrs[table_name]
        record_count = type_record_counts[table_name]

        columns = [
            {
                "name": "id",
                "type": "BIGSERIAL",
                "nullable": False,
                "primary_key": True,
            },
            {
                "name": "canonical_name",
                "type": "VARCHAR(255)",
                "nullable": False,
                "primary_key": False,
                "unique": True,
            },
        ]

        for attr_key in sorted(attrs.keys()):
            col_name = _sanitize_column_name(attr_key)
            if col_name in ("id", "canonical_name"):
                continue
            values = attrs[attr_key]
            sql_type = infer_sql_type(values)
            # Nullable if column appears in fewer than 50% of records
            nullable = len(values) < (record_count * 0.5)

            columns.append({
                "name": col_name,
                "type": sql_type,
                "nullable": nullable,
                "primary_key": False,
            })

        # Add standard audit columns
        columns.extend([
            {"name": "source_file", "type": "VARCHAR(500)", "nullable": True, "primary_key": False},
            {"name": "created_at", "type": "TIMESTAMP", "nullable": False, "primary_key": False,
             "default": "NOW()"},
            {"name": "updated_at", "type": "TIMESTAMP", "nullable": False, "primary_key": False,
             "default": "NOW()"},
        ])

        # Determine foreign keys for this table
        # FK references canonical_name (VARCHAR) on the parent table, not id (BIGSERIAL)
        foreign_keys = []
        for (child, col), parent in FK_RULES.items():
            if child == table_name and any(c["name"] == col for c in columns):
                foreign_keys.append({
                    "column": col,
                    "references_table": parent,
                    "references_column": "canonical_name",
                })

        # Determine indexes (FK columns + canonical_name)
        indexes = [
            {"columns": ["canonical_name"], "unique": True},
        ]
        for fk in foreign_keys:
            indexes.append({"columns": [fk["column"]], "unique": False})

        tables.append({
            "table_name": table_name,
            "record_count": record_count,
            "columns": columns,
            "foreign_keys": foreign_keys,
            "indexes": indexes,
        })

    # Topological sort: parents before children
    tables = _topological_sort(tables)

    return {
        "version": "1.1",
        "generated_at": datetime.utcnow().isoformat(),
        "tables": tables,
    }


def schema_to_ddl(schema: dict) -> str:
    """
    Convert a structured schema dict to PostgreSQL DDL (CREATE TABLE statements).

    Improvements:
      - Uses CREATE TABLE IF NOT EXISTS for idempotency
      - Quotes reserved word identifiers
      - FKs reference canonical_name (VARCHAR) not id (BIGSERIAL)
      - Adds UNIQUE constraints on canonical_name
      - Adds CREATE INDEX statements for FK columns
      - Includes DEFAULT for timestamp columns
    """
    lines = [
        "-- DataArch.AI — Auto-generated PostgreSQL schema",
        f"-- Generated: {schema['generated_at']}",
        f"-- Version:   {schema['version']}",
        "",
    ]

    all_indexes = []

    for table in schema["tables"]:
        tname = table["table_name"]
        quoted_tname = _quote_identifier(tname)
        lines.append(f"CREATE TABLE IF NOT EXISTS {quoted_tname} (")

        col_defs = []
        pk_cols = []
        for col in table["columns"]:
            quoted_col = _quote_identifier(col["name"])
            parts = [f"    {quoted_col}", col["type"]]
            if not col["nullable"] and not col.get("primary_key"):
                parts.append("NOT NULL")
            if col.get("primary_key"):
                pk_cols.append(quoted_col)
            if col.get("unique") and not col.get("primary_key"):
                parts.append("UNIQUE")
            if col.get("default"):
                parts.append(f"DEFAULT {col['default']}")
            col_defs.append(" ".join(parts))

        if pk_cols:
            col_defs.append(f"    PRIMARY KEY ({', '.join(pk_cols)})")

        for fk in table.get("foreign_keys", []):
            fk_col = _quote_identifier(fk["column"])
            fk_ref_table = _quote_identifier(fk["references_table"])
            fk_ref_col = _quote_identifier(fk["references_column"])
            col_defs.append(
                f"    FOREIGN KEY ({fk_col}) REFERENCES {fk_ref_table}({fk_ref_col})"
            )

        lines.append(",\n".join(col_defs))
        lines.append(");")
        lines.append("")

        # Collect indexes for after table creation
        for idx in table.get("indexes", []):
            idx_cols = [_quote_identifier(c) for c in idx["columns"]]
            idx_name = f"idx_{tname}_{'_'.join(idx['columns'])}"
            unique_kw = "UNIQUE " if idx.get("unique") else ""
            all_indexes.append(
                f"CREATE {unique_kw}INDEX IF NOT EXISTS {idx_name} ON {quoted_tname} ({', '.join(idx_cols)});"
            )

    # Add all indexes at the end
    if all_indexes:
        lines.append("-- Indexes")
        lines.extend(all_indexes)
        lines.append("")

    return "\n".join(lines)


# ── File I/O ─────────────────────────────────────────────────────────────────

def load_registry(path: Path | None = None) -> EntityRegistry:
    """Load the EntityRegistry from disk."""
    path = path or REGISTRY_PATH
    if not path.exists():
        raise FileNotFoundError(
            f"Entity registry not found at {path}. "
            "Run the ontology mapper first (POST /ontology/map-all)."
        )
    data = json.loads(path.read_text())
    return EntityRegistry(**data)


def generate_and_save(registry_path: Path | None = None) -> dict:
    """
    Full pipeline: load registry → generate schema → write schema.sql + schema.json.
    Returns the structured schema dict.
    """
    SCHEMA_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    registry = load_registry(registry_path)
    schema = generate_schema(registry)
    ddl = schema_to_ddl(schema)

    sql_path = SCHEMA_OUTPUT_DIR / "schema.sql"
    json_path = SCHEMA_OUTPUT_DIR / "schema.json"

    sql_path.write_text(ddl)
    json_path.write_text(json.dumps(schema, indent=2))

    table_count = len(schema["tables"])
    col_count = sum(len(t["columns"]) for t in schema["tables"])
    print(f"[Schema] Generated {table_count} tables, {col_count} columns")
    print(f"[Schema] Saved → {sql_path}")
    print(f"[Schema] Saved → {json_path}")

    return schema


if __name__ == "__main__":
    generate_and_save()
