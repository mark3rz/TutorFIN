"""
routes/entities.py — Entity resolution endpoints.

Endpoints:
  POST /entities/duplicates      Find duplicate entity candidates
  POST /entities/merge           Merge confirmed entity pair
  POST /entities/merge/undo      Undo a merge operation
  GET  /entities/merge/history   List merge operations
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

from auth import TokenUser, get_current_user

router = APIRouter(prefix="/entities", tags=["entities"])


@router.post("/duplicates")
def find_duplicates(body: dict, user: TokenUser = Depends(get_current_user)):
    """Find potential duplicate entities using embedding cosine similarity."""
    from pipeline.entity_resolution import ensure_merge_history_table, find_duplicate_candidates

    entity_type = body.get("entity_type", "").strip()
    if not entity_type:
        raise HTTPException(status_code=400, detail="Missing 'entity_type' field.")

    ensure_merge_history_table()

    try:
        candidates = find_duplicate_candidates(
            entity_type=entity_type,
            threshold=body.get("threshold"),
            limit=body.get("limit", 50),
            company_id=body.get("company_id"),
            cross_company=body.get("cross_company", False),
        )
        return JSONResponse(content={
            "entity_type": entity_type,
            "candidates": candidates,
            "count": len(candidates),
        })
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Duplicate search failed: {e}")


@router.post("/merge")
def merge_entity_pair(body: dict, user: TokenUser = Depends(get_current_user)):
    """Merge source entity into target entity (source is absorbed/deleted)."""
    from pipeline.entity_resolution import ensure_merge_history_table, merge_entities

    for field in ("source_id", "target_id", "entity_type"):
        if field not in body:
            raise HTTPException(status_code=400, detail=f"Missing '{field}' field.")

    ensure_merge_history_table()

    try:
        result = merge_entities(
            source_id=body["source_id"],
            target_id=body["target_id"],
            entity_type=body["entity_type"],
            similarity_score=body.get("similarity_score"),
            merged_by=body.get("merged_by", "user"),
        )
        return JSONResponse(content=result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Merge failed: {e}")


@router.post("/merge/undo")
def undo_entity_merge(body: dict, user: TokenUser = Depends(get_current_user)):
    """Undo a previous merge by restoring the deleted entity from its snapshot."""
    from pipeline.entity_resolution import undo_merge

    merge_id = body.get("merge_id")
    if merge_id is None:
        raise HTTPException(status_code=400, detail="Missing 'merge_id' field.")

    try:
        result = undo_merge(merge_id)
        return JSONResponse(content=result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Undo failed: {e}")


@router.get("/merge/history")
def merge_history(
    entity_type: str | None = None,
    offset: int = 0,
    limit: int = 50,
    user: TokenUser = Depends(get_current_user),
):
    """List merge operations, newest first, with pagination."""
    from pipeline.entity_resolution import get_merge_history

    try:
        # Fetch enough to support offset + limit then slice in Python
        all_entries = get_merge_history(entity_type=entity_type, limit=offset + limit)
        page = all_entries[offset : offset + limit]
        return JSONResponse(content={
            "entries": page,
            "count": len(page),
            "total": len(all_entries),
            "offset": offset,
            "limit": limit,
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch history: {e}")
