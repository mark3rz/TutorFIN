"""
pipeline/ai_search.py — Semantic search (RAG) for DataArch.AI.

Embeds a user's natural language query and performs cosine similarity
search against entity embeddings stored in PostgreSQL via pgvector.

Phase 3, Step 3.2

Features:
  - Natural language query → embedding → cosine similarity search
  - Returns top-K matching entities with scores and context
  - Combines vector search with optional type filtering
  - Graceful degradation when pgvector or embeddings unavailable
"""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import ProgrammingError, OperationalError

import config
from pipeline.database import get_engine, _quote_identifier
from pipeline.embeddings import generate_embeddings

logger = logging.getLogger(__name__)

# ── Entity tables (loaded from DB via ontology_service) ──────────────────────

def _get_entity_tables() -> list[str]:
    try:
        from services.ontology_service import get_entity_table_names
        return get_entity_table_names()
    except Exception:
        return [
            "vendor", "customer", "employee", "product",
            "transaction", "contract", "financial_record", "business_unit",
        ]

ENTITY_TABLES = _get_entity_tables()


# ── Semantic search ─────────────────────────────────────────────────────────

def semantic_search(
    query: str,
    top_k: int = 10,
    entity_type: str | None = None,
    engine: Engine | None = None,
    company_id: int | None = None,
) -> dict:
    """
    Search for entities matching a natural language query using vector similarity.

    Process:
      1. Embed the query text using Voyage AI
      2. Search across all entity tables using cosine distance (pgvector <=>)
      3. Return top-K results ranked by similarity

    Args:
        query: Natural language search query
        top_k: Maximum number of results to return
        entity_type: Optional filter by ontology type (e.g., "vendor")
        engine: SQLAlchemy engine (uses default if None)

    Returns:
        {
            "query": "...",
            "results": [
                {
                    "canonical_name": "Acme Corp",
                    "entity_type": "vendor",
                    "similarity": 0.92,
                    "attributes": {...},
                    "source_file": "...",
                },
                ...
            ],
            "total_results": 10,
        }
    """
    engine = engine or get_engine()

    # 1. Embed the query
    # NOTE: input_type="query" is required for Voyage AI search queries.
    # Using "document" (the indexing type) reduces retrieval quality.
    try:
        query_embeddings = generate_embeddings(
            [query],
            model=config.EMBEDDING_MODEL,
            input_type="query",
        )
        query_vec = query_embeddings[0]
    except Exception as e:
        logger.error(f"Failed to embed query: {e}")
        return {
            "query": query,
            "results": [],
            "total_results": 0,
            "error": f"Embedding failed: {e}",
        }

    # Format as pgvector string
    vec_str = "[" + ",".join(str(v) for v in query_vec) + "]"

    # 2. Search across tables
    tables_to_search = [entity_type] if entity_type and entity_type in ENTITY_TABLES else ENTITY_TABLES

    all_results = []

    with engine.connect() as conn:
        for table in tables_to_search:
            quoted = _quote_identifier(table)

            try:
                # Check if embedding column exists and has data
                col_check = conn.execute(text(
                    f"SELECT COUNT(*) FROM {quoted} WHERE embedding IS NOT NULL"
                ))
                count = col_check.scalar()
                if count == 0:
                    continue

                # Get all column names (excluding embedding) for result data
                col_info = conn.execute(text(
                    f"SELECT column_name FROM information_schema.columns "
                    f"WHERE table_name = :table AND column_name != 'embedding' "
                    f"AND column_name != 'id'"
                ), {"table": table})
                columns = [row[0] for row in col_info]

                # Build SELECT with similarity score
                col_list = ", ".join(_quote_identifier(c) for c in columns)

                # Phase 5: optional company_id filter
                where_clause = "WHERE embedding IS NOT NULL"
                params = {"vec": vec_str, "limit": top_k}
                if company_id is not None:
                    where_clause += " AND company_id = :company_id"
                    params["company_id"] = company_id

                result = conn.execute(text(
                    f"SELECT {col_list}, "
                    f"1 - (embedding <=> :vec::vector) as similarity "
                    f"FROM {quoted} "
                    f"{where_clause} "
                    f"ORDER BY embedding <=> :vec::vector "
                    f"LIMIT :limit"
                ), params)

                for row in result:
                    row_dict = dict(zip(columns + ["similarity"], row))
                    row_dict["entity_type"] = table

                    # Round similarity for readability
                    if "similarity" in row_dict and row_dict["similarity"] is not None:
                        row_dict["similarity"] = round(float(row_dict["similarity"]), 4)

                    # Convert any non-serializable types
                    for k, v in row_dict.items():
                        if hasattr(v, "isoformat"):
                            row_dict[k] = v.isoformat()
                        elif isinstance(v, (int, float, str, bool, type(None))):
                            pass
                        else:
                            row_dict[k] = str(v)

                    all_results.append(row_dict)

            except (ProgrammingError, OperationalError) as e:
                logger.warning(f"Search in '{table}' failed: {e}")
                continue

    # 3. Sort all results by similarity and take top-K
    all_results.sort(key=lambda r: r.get("similarity", 0), reverse=True)
    top_results = all_results[:top_k]

    return {
        "query": query,
        "results": top_results,
        "total_results": len(top_results),
    }


# ── Simple text search fallback ─────────────────────────────────────────────

def text_search(
    query: str,
    top_k: int = 10,
    entity_type: str | None = None,
    engine: Engine | None = None,
    company_id: int | None = None,
) -> dict:
    """
    Fallback text search using ILIKE when vector search is unavailable.

    Searches canonical_name and source_file columns across entity tables.
    """
    engine = engine or get_engine()

    tables_to_search = [entity_type] if entity_type and entity_type in ENTITY_TABLES else ENTITY_TABLES
    search_pattern = f"%{query}%"

    all_results = []

    with engine.connect() as conn:
        for table in tables_to_search:
            quoted = _quote_identifier(table)

            try:
                # Get column names
                col_info = conn.execute(text(
                    f"SELECT column_name FROM information_schema.columns "
                    f"WHERE table_name = :table "
                    f"AND column_name NOT IN ('embedding', 'id')"
                ), {"table": table})
                columns = [row[0] for row in col_info]

                if not columns:
                    continue

                col_list = ", ".join(_quote_identifier(c) for c in columns)

                # Search canonical_name with ILIKE
                # Phase 5: optional company_id filter
                where_clause = "WHERE canonical_name ILIKE :pattern"
                params = {"pattern": search_pattern, "limit": top_k}
                if company_id is not None:
                    where_clause += " AND company_id = :company_id"
                    params["company_id"] = company_id

                result = conn.execute(text(
                    f"SELECT {col_list} FROM {quoted} "
                    f"{where_clause} "
                    f"LIMIT :limit"
                ), params)

                for row in result:
                    row_dict = dict(zip(columns, row))
                    row_dict["entity_type"] = table
                    row_dict["similarity"] = None  # No similarity score for text search

                    for k, v in row_dict.items():
                        if hasattr(v, "isoformat"):
                            row_dict[k] = v.isoformat()
                        elif isinstance(v, (int, float, str, bool, type(None))):
                            pass
                        else:
                            row_dict[k] = str(v)

                    all_results.append(row_dict)

            except (ProgrammingError, OperationalError) as e:
                logger.warning(f"Text search in '{table}' failed: {e}")
                continue

    return {
        "query": query,
        "results": all_results[:top_k],
        "total_results": len(all_results[:top_k]),
        "search_type": "text",
    }
