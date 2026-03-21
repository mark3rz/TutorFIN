"""
routes/database.py — Database management endpoints.

Endpoints:
  GET  /database/health   Check database connectivity
  POST /database/create   Execute DDL (create tables)
  POST /database/load     Load entity data into tables
  POST /database/reset    Drop and recreate all tables (pe_admin only)
  GET  /database/stats    Row counts and table sizes
  POST /database/query    Execute read-only SQL query
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

from auth import TokenUser, get_optional_user, require_role
from models import UserRole

router = APIRouter(prefix="/database", tags=["database"])


@router.get("/health")
def database_health():
    """Check database connectivity and return status info."""
    from pipeline.database import check_health

    return JSONResponse(content=check_health())


@router.post("/create")
def database_create(user: Optional[TokenUser] = Depends(get_optional_user)):
    """Execute the generated DDL against the PostgreSQL database."""
    from pipeline.database import execute_schema, load_schema_from_file

    try:
        schema = load_schema_from_file()
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    try:
        result = execute_schema(schema)
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Schema execution failed: {e}")


@router.post("/load")
def database_load(user: Optional[TokenUser] = Depends(get_optional_user)):
    """Load entity registry data into the PostgreSQL database."""
    from pipeline.data_loader import load_from_files

    try:
        result = load_from_files()
        return JSONResponse(content=result)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Data load failed: {e}")


@router.post("/reset")
def database_reset(
    confirm: bool = False,
    user: TokenUser = Depends(require_role([UserRole.PE_ADMIN])),
):
    """Drop and recreate all DataArch tables.

    WARNING: Permanently deletes all data.
    Requires pe_admin role and ?confirm=true query parameter.
    """
    if not confirm:
        raise HTTPException(
            status_code=400,
            detail="This will delete all data. Add ?confirm=true to proceed.",
        )

    from pipeline.database import drop_all_tables, execute_schema, load_schema_from_file

    try:
        schema = load_schema_from_file()
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    try:
        drop_result = drop_all_tables(schema)
        create_result = execute_schema(schema)
        return JSONResponse(content={"dropped": drop_result, "created": create_result})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database reset failed: {e}")


@router.get("/stats")
def database_stats(user: Optional[TokenUser] = Depends(get_optional_user)):
    """Get row counts and table sizes for all DataArch tables."""
    from pipeline.database import get_table_stats

    try:
        stats = get_table_stats()
        return JSONResponse(content=stats)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not get stats: {e}")


@router.post("/query")
def database_query(body: dict, user: Optional[TokenUser] = Depends(get_optional_user)):
    """Execute a read-only SQL query against the database.

    Only SELECT and WITH (CTE) queries are allowed.
    Request body: {"sql": "SELECT * FROM vendor LIMIT 10"}
    """
    from pipeline.database import execute_readonly_query

    sql = body.get("sql", "").strip()
    if not sql:
        raise HTTPException(status_code=400, detail="Missing 'sql' field in request body.")

    try:
        result = execute_readonly_query(sql, max_rows=body.get("max_rows", 500))
        return JSONResponse(content=result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")
