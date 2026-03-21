"""
routes/ontology.py — Ontology mapping and entity registry endpoints.

Endpoints:
  POST /ontology/map/{id}   Run ontology mapper on a parsed document
  POST /ontology/map-all    Map all parsed documents
  GET  /ontology/registry   Get the full entity registry
  GET  /ontology/{id}       Get ontology result for a document
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

from auth import TokenUser, get_optional_user
from pipeline.ontology.mapper import map_all_outputs, map_from_parsed_json

router = APIRouter(prefix="/ontology", tags=["ontology"])

OUTPUTS_DIR = Path("outputs")
ONTOLOGY_DIR = Path("outputs/ontology")


@router.post("/map/{document_id}")
def map_ontology(
    document_id: str,
    user: Optional[TokenUser] = Depends(get_optional_user),
):
    """Run the ontology mapper on a previously parsed document."""
    parsed_path = OUTPUTS_DIR / f"{document_id}.json"
    if not parsed_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"No parsed result found for '{document_id}'. Ingest it first.",
        )
    try:
        result = map_from_parsed_json(parsed_path)
        return JSONResponse(content=result.to_output_dict())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/map-all")
def map_all(user: Optional[TokenUser] = Depends(get_optional_user)):
    """Run the ontology mapper across all parsed documents."""
    try:
        results = map_all_outputs()
        return {"mapped": len(results), "documents": [r.source_file for r in results]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/registry")
def get_registry(user: Optional[TokenUser] = Depends(get_optional_user)):
    """Return the full entity registry (all unique canonical entities)."""
    registry_path = ONTOLOGY_DIR / "entity_registry.json"
    if not registry_path.exists():
        return {"entries": {}, "updated_at": None}
    return JSONResponse(content=json.loads(registry_path.read_text()))


@router.get("/{document_id}")
def get_ontology_result(
    document_id: str,
    user: Optional[TokenUser] = Depends(get_optional_user),
):
    """Fetch the ontology mapping result for a specific document."""
    path = ONTOLOGY_DIR / f"{document_id}_ontology.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"No ontology result for '{document_id}'.")
    return JSONResponse(content=json.loads(path.read_text()))
