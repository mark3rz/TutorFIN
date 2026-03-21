"""
pipeline/company.py — Portfolio company management for DataArch.AI.

Provides:
  - Pydantic models for portfolio companies
  - CRUD operations against PostgreSQL
  - Idempotent table creation (no Alembic)
  - Slug generation for URL-safe company identifiers

Phase 5, Step 5.1 — Multi-Company Data Model
"""

from __future__ import annotations

import logging
import re
import unicodedata
from datetime import date, datetime, timezone
from typing import Any

from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError, ProgrammingError, OperationalError

from pipeline.database import get_engine

logger = logging.getLogger(__name__)


# ── Pydantic Models ───────────────────────────────────────────────────────

class PortfolioCompany(BaseModel):
    """A portfolio company managed by the PE firm."""
    id: int | None = None
    name: str
    slug: str
    sector: str | None = None
    acquisition_date: date | None = None
    hold_period_years: float | None = None
    fund: str | None = None
    status: str = "active"  # active | exited | pending
    notes: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class CompanyCreate(BaseModel):
    """Request model for creating a new portfolio company."""
    name: str
    sector: str | None = None
    acquisition_date: date | None = None
    hold_period_years: float | None = None
    fund: str | None = None
    notes: str | None = None


class CompanyUpdate(BaseModel):
    """Request model for updating an existing portfolio company."""
    name: str | None = None
    sector: str | None = None
    acquisition_date: date | None = None
    hold_period_years: float | None = None
    fund: str | None = None
    status: str | None = None
    notes: str | None = None


# ── Slug Generation ───────────────────────────────────────────────────────

def _slugify(name: str) -> str:
    """
    Convert a company name to a URL-safe slug.

    'Acme Corporation' → 'acme-corporation'
    'Smith & Sons LLC' → 'smith-sons-llc'
    'Über Technologies' → 'uber-technologies'
    """
    # Normalize unicode (Über → Uber)
    slug = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    # Lowercase
    slug = slug.lower().strip()
    # Replace non-alphanumeric with hyphens
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    # Collapse multiple hyphens and strip leading/trailing
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug or "unnamed"


# ── Table Management ──────────────────────────────────────────────────────

PORTFOLIO_COMPANY_DDL = """
CREATE TABLE IF NOT EXISTS portfolio_company (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    sector VARCHAR(255),
    acquisition_date DATE,
    hold_period_years DECIMAL(4,1),
    fund VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
"""

PORTFOLIO_COMPANY_INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_portfolio_company_slug ON portfolio_company (slug);",
    "CREATE INDEX IF NOT EXISTS idx_portfolio_company_status ON portfolio_company (status);",
    "CREATE INDEX IF NOT EXISTS idx_portfolio_company_fund ON portfolio_company (fund);",
]


def ensure_portfolio_table(engine: Engine | None = None) -> dict:
    """
    Create the portfolio_company table if it does not exist.
    Idempotent — safe to call on every app startup.

    Returns: {"created": bool, "errors": [...]}
    """
    engine = engine or get_engine()
    result = {"created": False, "errors": []}

    try:
        with engine.begin() as conn:
            conn.execute(text(PORTFOLIO_COMPANY_DDL))
            for idx_ddl in PORTFOLIO_COMPANY_INDEXES:
                conn.execute(text(idx_ddl))
            result["created"] = True
            logger.info("portfolio_company table ensured.")
    except (ProgrammingError, OperationalError) as e:
        result["errors"].append(str(e).split("\n")[0])
        logger.error(f"Failed to ensure portfolio_company table: {e}")

    return result


# ── CRUD Operations ────────────────────────────────────────────────────────

def create_company(
    data: CompanyCreate,
    engine: Engine | None = None,
) -> PortfolioCompany:
    """
    Create a new portfolio company.
    Generates a slug from the name automatically.

    Raises IntegrityError if a company with the same name or slug exists.
    """
    engine = engine or get_engine()
    slug = _slugify(data.name)

    with engine.begin() as conn:
        result = conn.execute(
            text(
                "INSERT INTO portfolio_company (name, slug, sector, acquisition_date, "
                "hold_period_years, fund, notes) "
                "VALUES (:name, :slug, :sector, :acquisition_date, "
                ":hold_period_years, :fund, :notes) "
                "RETURNING id, name, slug, sector, acquisition_date, hold_period_years, "
                "fund, status, notes, created_at, updated_at"
            ),
            {
                "name": data.name,
                "slug": slug,
                "sector": data.sector,
                "acquisition_date": data.acquisition_date,
                "hold_period_years": data.hold_period_years,
                "fund": data.fund,
                "notes": data.notes,
            },
        )
        row = result.fetchone()

    return PortfolioCompany(
        id=row[0],
        name=row[1],
        slug=row[2],
        sector=row[3],
        acquisition_date=row[4],
        hold_period_years=float(row[5]) if row[5] is not None else None,
        fund=row[6],
        status=row[7],
        notes=row[8],
        created_at=row[9],
        updated_at=row[10],
    )


def get_company(
    company_id: int,
    engine: Engine | None = None,
) -> PortfolioCompany | None:
    """Get a portfolio company by ID. Returns None if not found."""
    engine = engine or get_engine()

    with engine.connect() as conn:
        result = conn.execute(
            text(
                "SELECT id, name, slug, sector, acquisition_date, hold_period_years, "
                "fund, status, notes, created_at, updated_at "
                "FROM portfolio_company WHERE id = :id"
            ),
            {"id": company_id},
        )
        row = result.fetchone()

    if row is None:
        return None

    return _row_to_company(row)


def get_company_by_slug(
    slug: str,
    engine: Engine | None = None,
) -> PortfolioCompany | None:
    """Get a portfolio company by slug. Returns None if not found."""
    engine = engine or get_engine()

    with engine.connect() as conn:
        result = conn.execute(
            text(
                "SELECT id, name, slug, sector, acquisition_date, hold_period_years, "
                "fund, status, notes, created_at, updated_at "
                "FROM portfolio_company WHERE slug = :slug"
            ),
            {"slug": slug},
        )
        row = result.fetchone()

    if row is None:
        return None

    return _row_to_company(row)


def list_companies(
    engine: Engine | None = None,
    status: str | None = None,
) -> list[PortfolioCompany]:
    """List all portfolio companies, optionally filtered by status."""
    engine = engine or get_engine()

    sql = (
        "SELECT id, name, slug, sector, acquisition_date, hold_period_years, "
        "fund, status, notes, created_at, updated_at "
        "FROM portfolio_company"
    )
    params: dict[str, Any] = {}

    if status:
        sql += " WHERE status = :status"
        params["status"] = status

    sql += " ORDER BY name"

    with engine.connect() as conn:
        result = conn.execute(text(sql), params)
        rows = result.fetchall()

    return [_row_to_company(row) for row in rows]


def update_company(
    company_id: int,
    data: CompanyUpdate,
    engine: Engine | None = None,
) -> PortfolioCompany | None:
    """
    Update an existing portfolio company.
    Only updates fields that are not None in the request.
    Regenerates slug if name changes.
    Returns the updated company, or None if not found.
    """
    engine = engine or get_engine()

    # Build dynamic SET clause from non-None fields
    updates = {}
    for field_name, value in data.model_dump(exclude_none=True).items():
        updates[field_name] = value

    if not updates:
        return get_company(company_id, engine)

    # Regenerate slug if name changes
    if "name" in updates:
        updates["slug"] = _slugify(updates["name"])

    # Always update updated_at
    updates["updated_at"] = datetime.now(timezone.utc)

    set_clause = ", ".join(f"{k} = :{k}" for k in updates)
    updates["company_id"] = company_id

    with engine.begin() as conn:
        result = conn.execute(
            text(
                f"UPDATE portfolio_company SET {set_clause} "
                f"WHERE id = :company_id "
                f"RETURNING id, name, slug, sector, acquisition_date, hold_period_years, "
                f"fund, status, notes, created_at, updated_at"
            ),
            updates,
        )
        row = result.fetchone()

    if row is None:
        return None

    return _row_to_company(row)


def _row_to_company(row) -> PortfolioCompany:
    """Convert a database row tuple to a PortfolioCompany model."""
    return PortfolioCompany(
        id=row[0],
        name=row[1],
        slug=row[2],
        sector=row[3],
        acquisition_date=row[4],
        hold_period_years=float(row[5]) if row[5] is not None else None,
        fund=row[6],
        status=row[7],
        notes=row[8],
        created_at=row[9],
        updated_at=row[10],
    )
