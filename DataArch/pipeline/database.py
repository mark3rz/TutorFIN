"""
pipeline/database.py — PostgreSQL database layer for DataArch.AI.

Provides:
  - Connection management via SQLAlchemy (sync engine + connection pooling)
  - Health check and auto-reconnect
  - Schema execution engine (creates tables from generated DDL)
  - Read-only query execution (for analytics agent)
  - Table stats (row counts)

Phase 2, Steps 2.1 + 2.2
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine, text, inspect
from sqlalchemy.engine import Engine
from sqlalchemy.pool import QueuePool
from sqlalchemy.exc import OperationalError, ProgrammingError

import config

logger = logging.getLogger(__name__)

# ── Module-level engine (lazy singleton) ────────────────────────────────────

_engine: Engine | None = None


def get_engine() -> Engine:
    """
    Get or create the SQLAlchemy engine with connection pooling.
    Uses DATABASE_URL from config.
    """
    global _engine
    if _engine is None:
        _engine = create_engine(
            config.DATABASE_URL,
            poolclass=QueuePool,
            pool_size=config.DB_POOL_SIZE,
            max_overflow=config.DB_MAX_OVERFLOW,
            pool_timeout=config.DB_POOL_TIMEOUT,
            pool_pre_ping=True,  # auto-reconnect on stale connections
            echo=config.DB_ECHO,
        )
        logger.info(f"Database engine created: {_mask_url(config.DATABASE_URL)}")
    return _engine


def reset_engine() -> None:
    """Dispose of the current engine (for testing or reconnection)."""
    global _engine
    if _engine is not None:
        _engine.dispose()
        _engine = None
        logger.info("Database engine disposed.")


def _mask_url(url: str) -> str:
    """Mask password in database URL for safe logging."""
    try:
        if "@" in url and ":" in url.split("@")[0]:
            prefix, rest = url.rsplit("@", 1)
            scheme_user = prefix.rsplit(":", 1)[0]
            return f"{scheme_user}:****@{rest}"
    except Exception:
        pass
    return url


# ── Health Check ────────────────────────────────────────────────────────────

def check_health() -> dict:
    """
    Check database connectivity and return status info.
    Returns a dict with status, version, and database name.
    """
    try:
        engine = get_engine()
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version()"))
            pg_version = result.scalar()
            result = conn.execute(text("SELECT current_database()"))
            db_name = result.scalar()
        return {
            "status": "connected",
            "database": db_name,
            "postgres_version": pg_version,
            "pool_size": config.DB_POOL_SIZE,
        }
    except OperationalError as e:
        logger.error(f"Database health check failed: {e}")
        return {
            "status": "disconnected",
            "error": str(e).split("\n")[0],
        }


# ── Schema Execution ───────────────────────────────────────────────────────

def execute_schema(schema: dict, engine: Engine | None = None) -> dict:
    """
    Execute DDL from a structured schema dict against the live database.

    Creates tables in topological order (the schema is already sorted).
    Uses IF NOT EXISTS for idempotency.

    Returns:
      {
        "tables_created": ["vendor", "customer", ...],
        "tables_skipped": ["vendor"],  # already existed
        "tables_failed": [{"table": "x", "error": "..."}],
        "indexes_created": int,
      }
    """
    engine = engine or get_engine()
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    results = {
        "tables_created": [],
        "tables_skipped": [],
        "tables_failed": [],
        "indexes_created": 0,
    }

    with engine.begin() as conn:
        for table_def in schema.get("tables", []):
            tname = table_def["table_name"]
            try:
                ddl = _table_to_ddl(table_def)
                conn.execute(text(ddl))

                if tname in existing_tables:
                    results["tables_skipped"].append(tname)
                    logger.info(f"Table '{tname}' already exists (IF NOT EXISTS).")
                else:
                    results["tables_created"].append(tname)
                    logger.info(f"Created table '{tname}'.")

            except (ProgrammingError, OperationalError) as e:
                results["tables_failed"].append({
                    "table": tname,
                    "error": str(e).split("\n")[0],
                })
                logger.error(f"Failed to create table '{tname}': {e}")

        # Create indexes
        for table_def in schema.get("tables", []):
            for idx in table_def.get("indexes", []):
                try:
                    idx_ddl = _index_to_ddl(table_def["table_name"], idx)
                    conn.execute(text(idx_ddl))
                    results["indexes_created"] += 1
                except (ProgrammingError, OperationalError) as e:
                    # Index already exists — not a failure
                    logger.debug(f"Index creation note: {e}")

    total = len(results["tables_created"])
    skipped = len(results["tables_skipped"])
    failed = len(results["tables_failed"])
    logger.info(
        f"Schema execution complete: {total} created, {skipped} skipped, {failed} failed."
    )

    return results


def _quote_identifier(name: str) -> str:
    """Double-quote SQL reserved words."""
    from pipeline.schema_generator import SQL_RESERVED_WORDS
    lower = name.lower()
    if lower in SQL_RESERVED_WORDS:
        return f'"{lower}"'
    return lower


def _table_to_ddl(table_def: dict) -> str:
    """Generate CREATE TABLE IF NOT EXISTS DDL for a single table definition."""
    tname = _quote_identifier(table_def["table_name"])
    col_defs = []
    pk_cols = []

    for col in table_def["columns"]:
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

    for fk in table_def.get("foreign_keys", []):
        fk_col = _quote_identifier(fk["column"])
        fk_ref_table = _quote_identifier(fk["references_table"])
        fk_ref_col = _quote_identifier(fk["references_column"])
        col_defs.append(
            f"    FOREIGN KEY ({fk_col}) REFERENCES {fk_ref_table}({fk_ref_col})"
        )

    return f"CREATE TABLE IF NOT EXISTS {tname} (\n{','.join(chr(10) + d for d in col_defs)}\n);"


def _index_to_ddl(table_name: str, idx_def: dict) -> str:
    """Generate CREATE INDEX IF NOT EXISTS DDL for a single index definition."""
    if idx_def.get("functional"):
        # Functional index with custom expression (e.g., COALESCE composite unique)
        expr = idx_def["expression"].replace("{table}", table_name)
        return f"{expr};"
    quoted_table = _quote_identifier(table_name)
    idx_cols = [_quote_identifier(c) for c in idx_def["columns"]]
    idx_name = f"idx_{table_name}_{'_'.join(idx_def['columns'])}"
    unique_kw = "UNIQUE " if idx_def.get("unique") else ""
    return f"CREATE {unique_kw}INDEX IF NOT EXISTS {idx_name} ON {quoted_table} ({', '.join(idx_cols)});"


# ── V2 Migration: Portfolio Company Support ─────────────────────────────────

# Entity tables (loaded from DB via ontology_service, with hardcoded fallback)
def _get_entity_tables() -> list[str]:
    try:
        from services.ontology_service import get_entity_table_names
        return get_entity_table_names()
    except Exception:
        return [
            "vendor", "customer", "employee", "product",
            "transaction", "contract", "financial_record", "business_unit",
        ]

ENTITY_TABLES = _get_entity_tables()  # cached at import time for backward compat


def ensure_company_column(engine: Engine | None = None) -> dict:
    """
    Add company_id BIGINT column to all entity tables if it doesn't exist.
    Idempotent — uses ADD COLUMN IF NOT EXISTS.

    Returns: {"columns_added": [...], "errors": [...]}
    """
    engine = engine or get_engine()
    result = {"columns_added": [], "errors": []}

    with engine.begin() as conn:
        for table_name in ENTITY_TABLES:
            quoted = _quote_identifier(table_name)
            try:
                conn.execute(text(
                    f"ALTER TABLE {quoted} ADD COLUMN IF NOT EXISTS "
                    f"company_id BIGINT REFERENCES portfolio_company(id)"
                ))
                result["columns_added"].append(table_name)
                logger.info(f"Ensured company_id on '{table_name}'.")
            except (ProgrammingError, OperationalError) as e:
                # Table might not exist yet — that's OK
                result["errors"].append({
                    "table": table_name,
                    "error": str(e).split("\n")[0],
                })
                logger.debug(f"Could not add company_id to '{table_name}': {e}")

    return result


def migrate_to_v2(engine: Engine | None = None) -> dict:
    """
    Run all V2 (Phase 5) idempotent migrations:
      1. Create portfolio_company table
      2. Add company_id column to all entity tables
      3. Create composite unique indexes (canonical_name + company_id)

    Safe to call on every app startup. All operations are IF NOT EXISTS / IF EXISTS.

    Returns: {"portfolio_table": {...}, "company_columns": {...}, "indexes": {...}}
    """
    from pipeline.company import ensure_portfolio_table

    engine = engine or get_engine()
    result = {}

    # Step 1: Ensure portfolio_company table
    result["portfolio_table"] = ensure_portfolio_table(engine)

    # Step 2: Add company_id columns
    result["company_columns"] = ensure_company_column(engine)

    # Step 3: Create composite unique indexes on entity tables
    idx_result = {"created": [], "errors": []}
    with engine.begin() as conn:
        for table_name in ENTITY_TABLES:
            quoted = _quote_identifier(table_name)
            idx_name = f"idx_{table_name}_canonical_company"
            try:
                # Create composite unique index with COALESCE for NULL handling
                conn.execute(text(
                    f"CREATE UNIQUE INDEX IF NOT EXISTS {idx_name} "
                    f"ON {quoted} (canonical_name, COALESCE(company_id, -1))"
                ))
                idx_result["created"].append(table_name)
            except (ProgrammingError, OperationalError) as e:
                idx_result["errors"].append({
                    "table": table_name,
                    "error": str(e).split("\n")[0],
                })

        # Also create company_id indexes for FK lookups
        for table_name in ENTITY_TABLES:
            quoted = _quote_identifier(table_name)
            try:
                conn.execute(text(
                    f"CREATE INDEX IF NOT EXISTS idx_{table_name}_company_id "
                    f"ON {quoted} (company_id)"
                ))
            except (ProgrammingError, OperationalError):
                pass  # Non-critical

    result["indexes"] = idx_result
    logger.info(f"V2 migration complete: {result}")

    return result


# ── Schema Drop / Reset ────────────────────────────────────────────────────

def drop_all_tables(schema: dict, engine: Engine | None = None) -> dict:
    """
    Drop all tables defined in the schema (in reverse topological order).
    Uses CASCADE to handle FK dependencies.

    Returns: {"tables_dropped": [...], "tables_failed": [...]}
    """
    engine = engine or get_engine()
    results = {"tables_dropped": [], "tables_failed": []}

    # Reverse topological order so children are dropped before parents
    tables_reversed = list(reversed(schema.get("tables", [])))

    with engine.begin() as conn:
        for table_def in tables_reversed:
            tname = table_def["table_name"]
            quoted = _quote_identifier(tname)
            try:
                conn.execute(text(f"DROP TABLE IF EXISTS {quoted} CASCADE"))
                results["tables_dropped"].append(tname)
                logger.info(f"Dropped table '{tname}'.")
            except (ProgrammingError, OperationalError) as e:
                results["tables_failed"].append({
                    "table": tname,
                    "error": str(e).split("\n")[0],
                })

    return results


# ── Table Stats ─────────────────────────────────────────────────────────────

def get_table_stats(engine: Engine | None = None) -> dict:
    """
    Get row counts and sizes for all DataArch tables.

    Returns:
      {
        "tables": [
          {"table_name": "vendor", "row_count": 42, "size_bytes": 8192},
          ...
        ],
        "total_rows": 200,
        "total_tables": 8,
      }
    """
    engine = engine or get_engine()
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()

    tables = []
    total_rows = 0

    with engine.connect() as conn:
        for tname in sorted(existing_tables):
            try:
                quoted = _quote_identifier(tname)
                result = conn.execute(text(f"SELECT COUNT(*) FROM {quoted}"))
                count = result.scalar() or 0

                # Get table size
                result = conn.execute(text(
                    f"SELECT pg_total_relation_size('{tname}')"
                ))
                size = result.scalar() or 0

                tables.append({
                    "table_name": tname,
                    "row_count": count,
                    "size_bytes": size,
                })
                total_rows += count
            except (ProgrammingError, OperationalError) as e:
                logger.warning(f"Could not get stats for '{tname}': {e}")

    return {
        "tables": tables,
        "total_rows": total_rows,
        "total_tables": len(tables),
    }


# ── Read-only Query Execution ──────────────────────────────────────────────

def execute_readonly_query(
    sql: str,
    engine: Engine | None = None,
    max_rows: int = 500,
) -> dict:
    """
    Execute a read-only SQL query against the database.

    Safety:
      - Only SELECT statements are allowed
      - Results are limited to max_rows
      - Query timeout via statement_timeout

    Returns:
      {
        "columns": ["col1", "col2"],
        "rows": [{"col1": "val1", "col2": "val2"}, ...],
        "row_count": 42,
        "truncated": false,
      }
    """
    # Safety: block any non-SELECT statements
    stripped = sql.strip().lower()
    if not stripped.startswith("select") and not stripped.startswith("with"):
        raise ValueError("Only SELECT (and WITH/CTE) queries are allowed.")

    # Block dangerous keywords even within CTEs
    dangerous = ["insert", "update", "delete", "drop", "alter", "truncate", "create", "grant", "revoke"]
    for keyword in dangerous:
        # Check for keyword as a standalone word (not part of column names)
        if f" {keyword} " in f" {stripped} ":
            raise ValueError(f"Query contains disallowed keyword: {keyword.upper()}")

    engine = engine or get_engine()

    with engine.connect() as conn:
        # Set a query timeout (10 seconds)
        conn.execute(text("SET statement_timeout = '10s'"))

        result = conn.execute(text(sql))
        columns = list(result.keys())
        rows = []
        truncated = False

        for i, row in enumerate(result):
            if i >= max_rows:
                truncated = True
                break
            rows.append(dict(zip(columns, row)))

    return {
        "columns": columns,
        "rows": rows,
        "row_count": len(rows),
        "truncated": truncated,
    }


# ── Schema Loading Helper ──────────────────────────────────────────────────

def load_schema_from_file(path: Path | None = None) -> dict:
    """Load the generated schema.json from disk."""
    path = path or Path(config.SCHEMA_OUTPUT_DIR) / "schema.json"
    if not path.exists():
        raise FileNotFoundError(
            f"Schema not found at {path}. "
            "Generate it first with POST /schema/generate."
        )
    return json.loads(path.read_text())
