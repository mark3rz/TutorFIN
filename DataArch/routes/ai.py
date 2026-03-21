"""
routes/ai.py — AI integration endpoints (embeddings, search, analytics).

Endpoints:
  POST /ai/embed    Generate vector embeddings for all entities
  POST /ai/search   Semantic search across entity data
  POST /ai/ask      Natural language SQL analytics
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

from auth import TokenUser, get_optional_user

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/embed")
def ai_embed(user: Optional[TokenUser] = Depends(get_optional_user)):
    """Generate vector embeddings for all entities and store in PostgreSQL."""
    from pipeline.embeddings import embed_all_entities, setup_pgvector

    try:
        setup_result = setup_pgvector()
        if setup_result.get("errors"):
            return JSONResponse(
                content={"status": "pgvector_setup_failed", "setup": setup_result},
                status_code=500,
            )

        embed_result = embed_all_entities()
        return JSONResponse(content={
            "status": "complete",
            "setup": setup_result,
            "embeddings": embed_result,
        })
    except ImportError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except EnvironmentError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding failed: {e}")


@router.post("/search")
def ai_search(body: dict, user: Optional[TokenUser] = Depends(get_optional_user)):
    """Semantic search across entity data using vector similarity.

    Request body: {"query": "which vendors have long payment terms?", "top_k": 10, "company_id": 1}
    Falls back to text search (ILIKE) if embeddings are not available.
    """
    from pipeline.ai_search import semantic_search, text_search

    query = body.get("query", "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="Missing 'query' field.")

    top_k = body.get("top_k", 10)
    entity_type = body.get("entity_type")
    company_id = body.get("company_id")

    # Enforce company scoping for non-admin users
    if user and not user.is_pe_admin and user.company_id:
        company_id = user.company_id

    try:
        result = semantic_search(
            query, top_k=top_k, entity_type=entity_type, company_id=company_id
        )
        return JSONResponse(content=result)
    except (EnvironmentError, ImportError):
        try:
            result = text_search(
                query, top_k=top_k, entity_type=entity_type, company_id=company_id
            )
            result["note"] = "Vector search unavailable. Using text search fallback."
            return JSONResponse(content=result)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Search failed: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {e}")


@router.post("/ask")
def ai_ask(body: dict, user: Optional[TokenUser] = Depends(get_optional_user)):
    """Ask a business question in plain English.

    Claude generates SQL, executes it, and returns a natural language answer.
    Request body: {"question": "what is the total transaction volume by vendor?", "company_id": 1}
    """
    from pipeline.ai_analyst import ask

    question = body.get("question", "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="Missing 'question' field.")

    company_id = body.get("company_id")

    # Enforce company scoping for non-admin users
    if user and not user.is_pe_admin and user.company_id:
        company_id = user.company_id

    try:
        result = ask(
            question,
            max_rows=body.get("max_rows", 100),
            company_id=company_id,
        )
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analytics failed: {e}")
