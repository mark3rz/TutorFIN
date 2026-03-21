"""
routes/dataflow.py — Data flow visualization endpoints.

Endpoints:
  POST /dataflow/generate   Generate the data flow graph
  GET  /dataflow             Get the data flow graph JSON
  GET  /dataflow/view        Serve the data flow visualization page
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse

from auth import TokenUser, get_optional_user
from pipeline.dataflow import (
    DATAFLOW_OUTPUT_DIR,
    generate_and_save as generate_dataflow_and_save,
)

router = APIRouter(prefix="/dataflow", tags=["dataflow"])

FRONTEND_DIR = Path(__file__).parent.parent / "frontend"


@router.post("/generate")
def generate_dataflow_endpoint(user: Optional[TokenUser] = Depends(get_optional_user)):
    """Generate the data flow graph from the entity registry and schema."""
    try:
        graph = generate_dataflow_and_save()
        return JSONResponse(content=graph)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
def get_dataflow(user: Optional[TokenUser] = Depends(get_optional_user)):
    """Return the generated data flow graph JSON."""
    path = DATAFLOW_OUTPUT_DIR / "dataflow.json"
    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail="Data flow graph not generated yet. Run POST /dataflow/generate first.",
        )
    return JSONResponse(content=json.loads(path.read_text()))
