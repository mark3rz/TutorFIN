"""
routes/portfolio.py — Portfolio companies and intelligence endpoints.

Endpoints:
  POST /companies                   Create a portfolio company
  GET  /companies                   List all portfolio companies
  GET  /companies/{id}              Get company detail
  PUT  /companies/{id}              Update a portfolio company
  GET  /portfolio/summary           Aggregate metrics across all companies
  GET  /portfolio/company/{id}/detail   Entity breakdown for one company
  GET  /portfolio/vendor-overlap    Vendors appearing in multiple companies
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from auth import TokenUser, get_optional_user
from pipeline.company import (
    CompanyCreate,
    CompanyUpdate,
    create_company,
    get_company,
    list_companies,
    update_company,
)

router = APIRouter(tags=["portfolio"])


# ── Portfolio Companies ────────────────────────────────────────────────────

@router.post("/companies")
def create_company_endpoint(
    body: dict,
    user: Optional[TokenUser] = Depends(get_optional_user),
):
    """Create a new portfolio company."""
    name = body.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Missing 'name' field.")

    try:
        data = CompanyCreate(
            name=name,
            sector=body.get("sector"),
            acquisition_date=body.get("acquisition_date"),
            hold_period_years=body.get("hold_period_years"),
            fund=body.get("fund"),
            notes=body.get("notes"),
        )
        company = create_company(data)
        return JSONResponse(content=company.model_dump(mode="json"), status_code=201)
    except IntegrityError:
        raise HTTPException(
            status_code=409,
            detail=f"A company with the name '{name}' already exists.",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create company: {e}")


@router.get("/companies")
def list_companies_endpoint(
    status: Optional[str] = None,
    user: Optional[TokenUser] = Depends(get_optional_user),
):
    """List all portfolio companies. Optional: ?status=active"""
    try:
        companies = list_companies(status=status)
        return JSONResponse(content={
            "count": len(companies),
            "companies": [c.model_dump(mode="json") for c in companies],
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list companies: {e}")


@router.get("/companies/{company_id}")
def get_company_endpoint(
    company_id: int,
    user: Optional[TokenUser] = Depends(get_optional_user),
):
    """Get a portfolio company by ID."""
    try:
        company = get_company(company_id)
        if company is None:
            raise HTTPException(status_code=404, detail=f"Company {company_id} not found.")
        return JSONResponse(content=company.model_dump(mode="json"))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get company: {e}")


@router.put("/companies/{company_id}")
def update_company_endpoint(
    company_id: int,
    body: dict,
    user: Optional[TokenUser] = Depends(get_optional_user),
):
    """Update an existing portfolio company."""
    try:
        data = CompanyUpdate(
            name=body.get("name"),
            sector=body.get("sector"),
            acquisition_date=body.get("acquisition_date"),
            hold_period_years=body.get("hold_period_years"),
            fund=body.get("fund"),
            status=body.get("status"),
            notes=body.get("notes"),
        )
        company = update_company(company_id, data)
        if company is None:
            raise HTTPException(status_code=404, detail=f"Company {company_id} not found.")
        return JSONResponse(content=company.model_dump(mode="json"))
    except HTTPException:
        raise
    except IntegrityError:
        raise HTTPException(status_code=409, detail="A company with that name already exists.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update company: {e}")


# ── Portfolio Intelligence ─────────────────────────────────────────────────

@router.get("/portfolio/summary")
def portfolio_summary(user: Optional[TokenUser] = Depends(get_optional_user)):
    """Aggregate metrics across all portfolio companies."""
    from pipeline.database import get_engine

    try:
        engine = get_engine()
        with engine.connect() as conn:
            try:
                company_count = conn.execute(
                    text("SELECT COUNT(*) FROM portfolio_company")
                ).scalar() or 0
            except Exception:
                company_count = 0

            entity_tables = [
                "vendor", "customer", "employee", "product",
                "transaction", "contract", "financial_record", "business_unit",
            ]
            entity_counts = {}
            total_entities = 0
            for table in entity_tables:
                try:
                    quoted = f'"{table}"' if table in ("transaction",) else table
                    count = conn.execute(
                        text(f"SELECT COUNT(*) FROM {quoted}")
                    ).scalar() or 0
                    entity_counts[table] = count
                    total_entities += count
                except Exception:
                    entity_counts[table] = 0

            doc_count = 0
            try:
                source_files = set()
                for table in entity_tables:
                    try:
                        quoted = f'"{table}"' if table in ("transaction",) else table
                        rows = conn.execute(
                            text(f"SELECT DISTINCT source_file FROM {quoted} WHERE source_file IS NOT NULL")
                        ).fetchall()
                        for row in rows:
                            source_files.add(row[0])
                    except Exception:
                        continue
                doc_count = len(source_files)
            except Exception:
                pass

        return JSONResponse(content={
            "total_companies": company_count,
            "total_entities": total_entities,
            "total_documents": doc_count,
            "entity_counts": entity_counts,
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Portfolio summary failed: {e}")


@router.get("/portfolio/company/{company_id}/detail")
def portfolio_company_detail(
    company_id: int,
    user: Optional[TokenUser] = Depends(get_optional_user),
):
    """Entity breakdown for a single portfolio company."""
    from pipeline.database import get_engine

    company = get_company(company_id)
    if company is None:
        raise HTTPException(status_code=404, detail=f"Company {company_id} not found.")

    try:
        engine = get_engine()
        entity_tables = [
            "vendor", "customer", "employee", "product",
            "transaction", "contract", "financial_record", "business_unit",
        ]
        entity_counts = {}
        entities = []

        with engine.connect() as conn:
            for table in entity_tables:
                try:
                    quoted = f'"{table}"' if table in ("transaction",) else table
                    count = conn.execute(
                        text(f"SELECT COUNT(*) FROM {quoted} WHERE company_id = :cid"),
                        {"cid": company_id},
                    ).scalar() or 0
                    entity_counts[table] = count

                    if count > 0:
                        rows = conn.execute(
                            text(
                                f"SELECT canonical_name, source_file FROM {quoted} "
                                f"WHERE company_id = :cid ORDER BY canonical_name LIMIT 100"
                            ),
                            {"cid": company_id},
                        ).fetchall()
                        for row in rows:
                            entities.append({
                                "entity_type": table,
                                "canonical_name": row[0],
                                "source_file": row[1],
                            })
                except Exception:
                    entity_counts[table] = 0

        return JSONResponse(content={
            "company": company.model_dump(mode="json"),
            "entity_counts": entity_counts,
            "total_entities": sum(entity_counts.values()),
            "entities": entities,
        })
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Company detail failed: {e}")


@router.get("/portfolio/vendor-overlap")
def portfolio_vendor_overlap(
    min_companies: int = 2,
    user: Optional[TokenUser] = Depends(get_optional_user),
):
    """Find vendors that appear across multiple portfolio companies."""
    from pipeline.database import get_engine

    try:
        engine = get_engine()
        with engine.connect() as conn:
            try:
                result = conn.execute(
                    text(
                        "SELECT v.canonical_name, "
                        "COUNT(DISTINCT v.company_id) as company_count, "
                        "ARRAY_AGG(DISTINCT pc.name) as company_names "
                        "FROM vendor v "
                        "JOIN portfolio_company pc ON v.company_id = pc.id "
                        "WHERE v.company_id IS NOT NULL "
                        "GROUP BY v.canonical_name "
                        "HAVING COUNT(DISTINCT v.company_id) >= :min_companies "
                        "ORDER BY company_count DESC, v.canonical_name "
                        "LIMIT 100"
                    ),
                    {"min_companies": min_companies},
                )

                overlaps = []
                for row in result:
                    overlaps.append({
                        "vendor_name": row[0],
                        "company_count": row[1],
                        "companies": list(row[2]) if row[2] else [],
                    })

                return JSONResponse(content={
                    "min_companies": min_companies,
                    "overlap_count": len(overlaps),
                    "overlaps": overlaps,
                })
            except Exception as e:
                return JSONResponse(content={
                    "min_companies": min_companies,
                    "overlap_count": 0,
                    "overlaps": [],
                    "note": f"Could not query vendor overlap: {e}",
                })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Vendor overlap query failed: {e}")
