"""
routes/schema.py — Schema generation endpoints.

Endpoints:
  POST /schema/generate   Generate schema from entity registry
  GET  /schema            Get the structured schema.json
  GET  /schema/sql        Get the raw DDL as text
"""

from __future__ import annotations

import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse, PlainTextResponse

from auth import TokenUser, get_optional_user
from pipeline.schema_generator import (
    SCHEMA_OUTPUT_DIR,
    generate_and_save as generate_schema_and_save,
)

router = APIRouter(prefix="/schema", tags=["schema"])


@router.post("/generate")
def generate_schema_endpoint(user: Optional[TokenUser] = Depends(get_optional_user)):
    """Generate a PostgreSQL schema from the current entity registry."""
    try:
        schema = generate_schema_and_save()
        return JSONResponse(content=schema)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
def get_schema(user: Optional[TokenUser] = Depends(get_optional_user)):
    """Return the generated schema.json."""
    path = SCHEMA_OUTPUT_DIR / "schema.json"
    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail="Schema not generated yet. Run POST /schema/generate first.",
        )
    return JSONResponse(content=json.loads(path.read_text()))


@router.get("/sql")
def get_schema_sql(user: Optional[TokenUser] = Depends(get_optional_user)):
    """Return the generated schema.sql DDL as plain text."""
    path = SCHEMA_OUTPUT_DIR / "schema.sql"
    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail="Schema not generated yet. Run POST /schema/generate first.",
        )
    return PlainTextResponse(content=path.read_text())
