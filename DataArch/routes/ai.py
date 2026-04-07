"""
routes/ai.py — AI integration endpoints (embeddings, search, analytics).

Endpoints:
  GET  /ai/status   Feature availability flags (Voyage, Anthropic keys)
  POST /ai/embed    Generate vector embeddings for all entities
  POST /ai/search   Semantic search across entity data
  POST /ai/ask      Natural language SQL analytics

v0.9.3 — Async event loop fix
  All three endpoints are now `async def` and offload their blocking LLM /
  Voyage AI calls to the default thread-pool executor via `_run_sync()`.
  This ensures the FastAPI event loop is never blocked during slow network
  I/O to Anthropic or Voyage AI (which can take 5–30 s per request).

  The underlying pipeline functions remain synchronous — they are designed to
  run in thread contexts (pipeline workers, run_in_executor).  Converting the
  full pipeline stack to async is deferred to a future refactor.
"""

from __future__ import annotations

import asyncio
import functools
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse

import config
from auth import TokenUser, get_current_user
from api import limiter

router = APIRouter(prefix="/ai", tags=["ai"])


# ── Status ───────────────────────────────────────────────────────────────────

@router.get("/status")
def ai_status():
    """
    Return AI feature availability flags.

    No auth required — used by the frontend to show/hide degradation banners.
    Does NOT expose actual key values, only boolean availability.
    """
    return JSONResponse(content={
        "anthropic_available": bool(config.ANTHROPIC_API_KEY),
        "voyage_available": bool(config.VOYAGE_API_KEY),
        "semantic_search_available": bool(config.VOYAGE_API_KEY),
        "embedding_model": config.EMBEDDING_MODEL if config.VOYAGE_API_KEY else None,
    })


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _run_sync(fn, *args, **kwargs):
    """
    Run a synchronous blocking function in the default thread-pool executor
    so it doesn't block the FastAPI event loop.
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, functools.partial(fn, *args, **kwargs))


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/embed")
async def ai_embed(user: TokenUser = Depends(get_current_user)):
    """Generate vector embeddings for all entities and store in PostgreSQL."""
    from pipeline.embeddings import embed_all_entities, setup_pgvector

    try:
        setup_result = await _run_sync(setup_pgvector)
        if setup_result.get("errors"):
            return JSONResponse(
                content={"status": "pgvector_setup_failed", "setup": setup_result},
                status_code=500,
            )

        embed_result = await _run_sync(embed_all_entities)
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
@limiter.limit("60/minute")
async def ai_search(
    request: Request,
    body: dict,
    user: TokenUser = Depends(get_current_user),
):
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
    if not user.is_pe_admin and user.company_id:
        company_id = user.company_id

    try:
        result = await _run_sync(
            semantic_search,
            query,
            top_k=top_k,
            entity_type=entity_type,
            company_id=company_id,
        )
        return JSONResponse(content=result)
    except (EnvironmentError, ImportError):
        try:
            result = await _run_sync(
                text_search,
                query,
                top_k=top_k,
                entity_type=entity_type,
                company_id=company_id,
            )
            result["note"] = "Vector search unavailable. Using text search fallback."
            return JSONResponse(content=result)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Search failed: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {e}")


@router.post("/ask")
@limiter.limit("30/minute")
async def ai_ask(
    request: Request,
    body: dict,
    user: TokenUser = Depends(get_current_user),
):
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
    if not user.is_pe_admin and user.company_id:
        company_id = user.company_id

    try:
        result = await _run_sync(
            ask,
            question,
            max_rows=body.get("max_rows", 100),
            company_id=company_id,
        )
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analytics failed: {e}")
