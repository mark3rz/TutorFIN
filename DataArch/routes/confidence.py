"""
routes/confidence.py — Confidence dashboard endpoints for DataArch.AI.

Provides aggregated confidence metrics and drill-down endpoints for
the extraction confidence dashboard.

Endpoints:
  GET /confidence/company/{company_id}       Per-entity-type confidence breakdown
  GET /confidence/portfolio                   Portfolio-wide confidence summary (PE admin only)
  GET /confidence/company/{company_id}/low   Low-confidence entities for review
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import text

from auth import TokenUser, get_current_user, require_role
from pipeline.company import get_company
from pipeline.database import get_engine, _quote_identifier

router = APIRouter(tags=["confidence"])


def _get_entity_tables() -> list[str]:
    """Get list of entity table names."""
    try:
        from services.ontology_service import get_entity_table_names
        return get_entity_table_names()
    except Exception:
        return [
            "vendor", "customer", "employee", "product",
            "transaction", "contract", "financial_record", "business_unit",
        ]


def _classify_confidence(confidence: float) -> str:
    """Classify confidence score into high/medium/low buckets."""
    if confidence >= 0.8:
        return "high"
    elif confidence >= 0.5:
        return "medium"
    else:
        return "low"


@router.get("/confidence/company/{company_id}")
def company_confidence_breakdown(
    company_id: int,
    user: TokenUser = Depends(get_current_user),
):
    """
    Get confidence breakdown for a single portfolio company.

    Returns per-entity-type and aggregate confidence metrics.

    PE admins can view any company. Company users can only view their own.
    """
    # Authorization: PE admin can see any company, company users only their own
    if not user.can_access_company(company_id):
        raise HTTPException(
            status_code=403,
            detail=f"You do not have access to company {company_id}.",
        )

    # Verify company exists
    company = get_company(company_id)
    if company is None:
        raise HTTPException(status_code=404, detail=f"Company {company_id} not found.")

    try:
        engine = get_engine()
        entity_tables = _get_entity_tables()

        by_entity_type = []
        total_entities = 0
        total_high = 0
        total_medium = 0
        total_low = 0
        confidence_sum = 0.0
        confidence_count = 0

        with engine.connect() as conn:
            for table in entity_tables:
                try:
                    quoted = _quote_identifier(table)

                    # Check if table exists and has extraction_confidence column
                    check_result = conn.execute(text(
                        "SELECT column_name FROM information_schema.columns "
                        "WHERE table_name = :table AND column_name = 'extraction_confidence'"
                    ), {"table": table}).fetchone()

                    if not check_result:
                        # Table doesn't have confidence column yet, skip
                        continue

                    # Get counts and averages for this entity type
                    result = conn.execute(text(f"""
                        SELECT
                            COUNT(*) as total,
                            AVG(extraction_confidence) as avg_confidence,
                            SUM(CASE WHEN extraction_confidence >= 0.8 THEN 1 ELSE 0 END) as high_count,
                            SUM(CASE WHEN extraction_confidence >= 0.5 AND extraction_confidence < 0.8 THEN 1 ELSE 0 END) as medium_count,
                            SUM(CASE WHEN extraction_confidence < 0.5 THEN 1 ELSE 0 END) as low_count
                        FROM {quoted}
                        WHERE company_id = :cid AND extraction_confidence IS NOT NULL
                    """), {"cid": company_id}).fetchone()

                    if result and result[0] > 0:
                        count, avg_conf, high, medium, low = result

                        by_entity_type.append({
                            "entity_type": table,
                            "total": count,
                            "avg_confidence": round(float(avg_conf or 0), 2),
                            "high": high or 0,
                            "medium": medium or 0,
                            "low": low or 0,
                        })

                        # Accumulate totals
                        total_entities += count
                        total_high += (high or 0)
                        total_medium += (medium or 0)
                        total_low += (low or 0)
                        if avg_conf:
                            confidence_sum += float(avg_conf) * count
                            confidence_count += count

                except Exception as e:
                    # Table might not exist or query failed — skip it
                    continue

        # Calculate overall average
        avg_confidence = round(confidence_sum / confidence_count, 2) if confidence_count > 0 else 0.0

        return JSONResponse(content={
            "company_id": company_id,
            "company_name": company.name,
            "summary": {
                "total_entities": total_entities,
                "avg_confidence": avg_confidence,
                "high": total_high,
                "medium": total_medium,
                "low": total_low,
            },
            "by_entity_type": sorted(by_entity_type, key=lambda x: x["entity_type"]),
        })

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get confidence breakdown: {e}"
        )


@router.get("/confidence/portfolio")
def portfolio_confidence_summary(
    user: TokenUser = Depends(require_role(["pe_admin"])),
):
    """
    Get portfolio-wide confidence summary (PE admin only).

    Returns aggregate confidence metrics across all companies.
    """
    try:
        from pipeline.company import list_companies

        engine = get_engine()
        entity_tables = _get_entity_tables()

        # Get all active companies
        companies = list_companies(status="active")

        by_company = []
        portfolio_total = 0
        portfolio_high = 0
        portfolio_medium = 0
        portfolio_low = 0
        portfolio_conf_sum = 0.0
        portfolio_conf_count = 0

        with engine.connect() as conn:
            for company in companies:
                company_id = company.id
                company_total = 0
                company_high = 0
                company_medium = 0
                company_low = 0
                company_conf_sum = 0.0
                company_conf_count = 0

                for table in entity_tables:
                    try:
                        quoted = _quote_identifier(table)

                        # Check if table has confidence column
                        check_result = conn.execute(text(
                            "SELECT column_name FROM information_schema.columns "
                            "WHERE table_name = :table AND column_name = 'extraction_confidence'"
                        ), {"table": table}).fetchone()

                        if not check_result:
                            continue

                        result = conn.execute(text(f"""
                            SELECT
                                COUNT(*) as total,
                                AVG(extraction_confidence) as avg_confidence,
                                SUM(CASE WHEN extraction_confidence >= 0.8 THEN 1 ELSE 0 END) as high_count,
                                SUM(CASE WHEN extraction_confidence >= 0.5 AND extraction_confidence < 0.8 THEN 1 ELSE 0 END) as medium_count,
                                SUM(CASE WHEN extraction_confidence < 0.5 THEN 1 ELSE 0 END) as low_count
                            FROM {quoted}
                            WHERE company_id = :cid AND extraction_confidence IS NOT NULL
                        """), {"cid": company_id}).fetchone()

                        if result and result[0] > 0:
                            count, avg_conf, high, medium, low = result
                            company_total += count
                            company_high += (high or 0)
                            company_medium += (medium or 0)
                            company_low += (low or 0)
                            if avg_conf:
                                company_conf_sum += float(avg_conf) * count
                                company_conf_count += count

                    except Exception:
                        continue

                if company_total > 0:
                    company_avg = round(company_conf_sum / company_conf_count, 2) if company_conf_count > 0 else 0.0

                    by_company.append({
                        "company_id": company_id,
                        "company_name": company.name,
                        "total_entities": company_total,
                        "avg_confidence": company_avg,
                        "high": company_high,
                        "medium": company_medium,
                        "low": company_low,
                    })

                    # Accumulate portfolio totals
                    portfolio_total += company_total
                    portfolio_high += company_high
                    portfolio_medium += company_medium
                    portfolio_low += company_low
                    portfolio_conf_sum += company_conf_sum
                    portfolio_conf_count += company_conf_count

        portfolio_avg = round(portfolio_conf_sum / portfolio_conf_count, 2) if portfolio_conf_count > 0 else 0.0

        return JSONResponse(content={
            "portfolio": {
                "total_entities": portfolio_total,
                "avg_confidence": portfolio_avg,
                "high": portfolio_high,
                "medium": portfolio_medium,
                "low": portfolio_low,
            },
            "by_company": sorted(by_company, key=lambda x: x["company_name"]),
        })

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get portfolio confidence summary: {e}"
        )


@router.get("/confidence/company/{company_id}/low")
def company_low_confidence_entities(
    company_id: int,
    offset: int = 0,
    limit: int = 50,
    entity_type: Optional[str] = None,
    user: TokenUser = Depends(get_current_user),
):
    """
    Get low-confidence entities (< 0.5) for a company with pagination.

    Optional filter by entity_type.
    PE admins can view any company. Company users can only view their own.
    """
    # Authorization
    if not user.can_access_company(company_id):
        raise HTTPException(
            status_code=403,
            detail=f"You do not have access to company {company_id}.",
        )

    # Verify company exists
    company = get_company(company_id)
    if company is None:
        raise HTTPException(status_code=404, detail=f"Company {company_id} not found.")

    try:
        engine = get_engine()
        entity_tables = _get_entity_tables()

        # Filter to specific entity type if requested
        if entity_type:
            if entity_type not in entity_tables:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid entity_type: {entity_type}. Must be one of {entity_tables}",
                )
            entity_tables = [entity_type]

        low_entities = []
        total_count = 0

        with engine.connect() as conn:
            for table in entity_tables:
                try:
                    quoted = _quote_identifier(table)

                    # Check if table has confidence column
                    check_result = conn.execute(text(
                        "SELECT column_name FROM information_schema.columns "
                        "WHERE table_name = :table AND column_name = 'extraction_confidence'"
                    ), {"table": table}).fetchone()

                    if not check_result:
                        continue

                    # Get total count first for pagination info
                    count_result = conn.execute(text(f"""
                        SELECT COUNT(*) FROM {quoted}
                        WHERE company_id = :cid
                        AND extraction_confidence IS NOT NULL
                        AND extraction_confidence < 0.5
                    """), {"cid": company_id}).scalar()

                    total_count += (count_result or 0)

                    # Fetch the actual entities
                    result = conn.execute(text(f"""
                        SELECT
                            canonical_name,
                            extraction_confidence,
                            source_file
                        FROM {quoted}
                        WHERE company_id = :cid
                        AND extraction_confidence IS NOT NULL
                        AND extraction_confidence < 0.5
                        ORDER BY extraction_confidence ASC, canonical_name
                        LIMIT :lim OFFSET :off
                    """), {"cid": company_id, "lim": limit, "off": offset}).fetchall()

                    for row in result:
                        low_entities.append({
                            "entity_type": table,
                            "canonical_name": row[0],
                            "extraction_confidence": float(row[1]) if row[1] else None,
                            "source_file": row[2],
                        })

                except Exception:
                    continue

        # Sort by confidence (lowest first) and apply pagination across all types
        low_entities.sort(key=lambda x: (x["extraction_confidence"] or 0, x["canonical_name"]))
        paginated = low_entities[offset:offset + limit]

        return JSONResponse(content={
            "company_id": company_id,
            "company_name": company.name,
            "entity_type_filter": entity_type,
            "total_low_confidence": total_count,
            "offset": offset,
            "limit": limit,
            "entities": paginated,
        })

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get low-confidence entities: {e}"
        )
