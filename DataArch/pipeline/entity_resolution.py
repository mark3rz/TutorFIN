"""
pipeline/entity_resolution.py — Entity resolution (fuzzy dedup + merge) for DataArch.AI.

Uses pgvector cosine similarity to find near-duplicate entities across the
portfolio, then supports human-in-the-loop merge with an undo audit trail.

Phase 5, Step 5.4

Features:
  - Duplicate candidate discovery via embedding cosine similarity
  - Human-confirmed merge: source entity absorbed into target
  - Full audit trail with JSONB snapshot for undo
  - Cross-company and within-company resolution modes
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import ProgrammingError, OperationalError

import config
from pipeline.database import get_engine, _quote_identifier

logger = logging.getLogger(__name__)

# Entity tables that support resolution (loaded from DB via ontology_service)
def _get_resolvable_tables() -> list[str]:
    try:
        from services.ontology_service import get_resolvable_table_names
        return get_resolvable_table_names()
    except Exception:
        return [
            "vendor", "customer", "employee", "product",
            "transaction", "contract", "financial_record", "business_unit",
        ]

RESOLVABLE_TABLES = _get_resolvable_tables()


# ── Models ────────────────────────────────────────────────────────────────────

class DuplicateCandidate(BaseModel):
    """A pair of potentially duplicate entities."""
    source_id: int
    source_name: str
    source_company_id: int | None = None
    target_id: int
    target_name: str
    target_company_id: int | None = None
    entity_type: str
    similarity: float


class MergeRequest(BaseModel):
    """Request to merge source entity into target entity."""
    source_id: int
    target_id: int
    entity_type: str
    merged_by: str = "user"


class MergeResult(BaseModel):
    """Result of a merge operation."""
    merge_id: int
    entity_type: str
    source_id: int
    source_name: str
    target_id: int
    target_name: str
    status: str = "merged"


class MergeHistoryEntry(BaseModel):
    """A single entry in the merge history."""
    id: int
    entity_type: str
    source_id: int
    source_canonical_name: str
    source_company_id: int | None = None
    target_id: int
    target_canonical_name: str
    target_company_id: int | None = None
    similarity_score: float | None = None
    merged_by: str
    merged_at: str
    undone_at: str | None = None


# ── Merge History Table ───────────────────────────────────────────────────────

MERGE_HISTORY_DDL = """
CREATE TABLE IF NOT EXISTS entity_merge_history (
    id BIGSERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    source_id BIGINT NOT NULL,
    target_id BIGINT NOT NULL,
    source_canonical_name VARCHAR(255),
    source_company_id BIGINT,
    target_canonical_name VARCHAR(255),
    target_company_id BIGINT,
    similarity_score DECIMAL(5,4),
    merged_by VARCHAR(50) DEFAULT 'user',
    merged_at TIMESTAMP DEFAULT NOW(),
    undone_at TIMESTAMP,
    previous_state JSONB
);
"""


def ensure_merge_history_table(engine: Engine | None = None) -> dict:
    """Create the entity_merge_history table if it doesn't exist."""
    engine = engine or get_engine()
    try:
        with engine.begin() as conn:
            conn.execute(text(MERGE_HISTORY_DDL))
        return {"status": "ok", "table": "entity_merge_history"}
    except Exception as e:
        logger.error(f"Failed to create merge history table: {e}")
        return {"status": "error", "error": str(e)}


# ── Duplicate Discovery ──────────────────────────────────────────────────────

def find_duplicate_candidates(
    entity_type: str,
    threshold: float | None = None,
    limit: int = 50,
    company_id: int | None = None,
    cross_company: bool = False,
    engine: Engine | None = None,
) -> list[dict]:
    """
    Find potential duplicate entities using cosine similarity on embeddings.

    Args:
        entity_type: Which entity table to search (e.g., "vendor")
        threshold: Minimum similarity score (0-1). Defaults to config value.
        limit: Maximum number of candidate pairs to return
        company_id: If set, only find duplicates within this company
        cross_company: If True, find duplicates across different companies
        engine: SQLAlchemy engine

    Returns:
        List of DuplicateCandidate dicts sorted by similarity descending
    """
    if entity_type not in RESOLVABLE_TABLES:
        raise ValueError(f"Invalid entity_type '{entity_type}'. Must be one of: {RESOLVABLE_TABLES}")

    threshold = threshold or config.DEFAULT_SIMILARITY_THRESHOLD
    engine = engine or get_engine()
    quoted = _quote_identifier(entity_type)

    # Build WHERE clause for filtering
    where_parts = [
        "a.embedding IS NOT NULL",
        "b.embedding IS NOT NULL",
        "a.id < b.id",  # avoid duplicate pairs and self-matches
    ]
    params: dict[str, Any] = {"threshold": threshold, "limit": limit}

    if company_id is not None and not cross_company:
        where_parts.append("a.company_id = :company_id")
        where_parts.append("b.company_id = :company_id")
        params["company_id"] = company_id
    elif cross_company:
        where_parts.append("a.company_id IS NOT NULL")
        where_parts.append("b.company_id IS NOT NULL")
        where_parts.append("a.company_id != b.company_id")

    where_clause = " AND ".join(where_parts)

    sql = f"""
        SELECT
            a.id as source_id,
            a.canonical_name as source_name,
            a.company_id as source_company_id,
            b.id as target_id,
            b.canonical_name as target_name,
            b.company_id as target_company_id,
            1 - (a.embedding <=> b.embedding) as similarity
        FROM {quoted} a
        CROSS JOIN {quoted} b
        WHERE {where_clause}
            AND 1 - (a.embedding <=> b.embedding) >= :threshold
        ORDER BY similarity DESC
        LIMIT :limit
    """

    candidates = []
    try:
        with engine.connect() as conn:
            result = conn.execute(text(sql), params)
            for row in result:
                candidates.append(DuplicateCandidate(
                    source_id=row[0],
                    source_name=row[1],
                    source_company_id=row[2],
                    target_id=row[3],
                    target_name=row[4],
                    target_company_id=row[5],
                    entity_type=entity_type,
                    similarity=round(float(row[6]), 4),
                ).model_dump())
    except (ProgrammingError, OperationalError) as e:
        logger.warning(f"Duplicate search failed for '{entity_type}': {e}")

    return candidates


# ── Merge ─────────────────────────────────────────────────────────────────────

def merge_entities(
    source_id: int,
    target_id: int,
    entity_type: str,
    similarity_score: float | None = None,
    merged_by: str = "user",
    engine: Engine | None = None,
) -> dict:
    """
    Merge source entity into target entity.

    Process:
      1. Snapshot the source entity row into merge_history (for undo)
      2. Delete the source entity row
      3. Record the merge in entity_merge_history

    Args:
        source_id: ID of the entity to be absorbed (deleted)
        target_id: ID of the entity to keep (survives)
        entity_type: Which entity table
        similarity_score: Optional similarity score from duplicate discovery
        merged_by: Who initiated the merge
        engine: SQLAlchemy engine

    Returns:
        MergeResult dict
    """
    if entity_type not in RESOLVABLE_TABLES:
        raise ValueError(f"Invalid entity_type '{entity_type}'.")

    engine = engine or get_engine()
    quoted = _quote_identifier(entity_type)

    with engine.begin() as conn:
        # 1. Fetch source entity for snapshot
        source_row = conn.execute(
            text(f"SELECT * FROM {quoted} WHERE id = :id"),
            {"id": source_id},
        ).mappings().first()

        if source_row is None:
            raise ValueError(f"Source entity {source_id} not found in {entity_type}.")

        # Fetch target entity name
        target_row = conn.execute(
            text(f"SELECT canonical_name, company_id FROM {quoted} WHERE id = :id"),
            {"id": target_id},
        ).mappings().first()

        if target_row is None:
            raise ValueError(f"Target entity {target_id} not found in {entity_type}.")

        # 2. Serialize source row snapshot (exclude embedding — too large)
        snapshot = {}
        for key, val in dict(source_row).items():
            if key == "embedding":
                continue
            if hasattr(val, "isoformat"):
                snapshot[key] = val.isoformat()
            elif isinstance(val, (int, float, str, bool, type(None))):
                snapshot[key] = val
            else:
                snapshot[key] = str(val)

        source_name = snapshot.get("canonical_name", "unknown")
        source_company_id = snapshot.get("company_id")
        target_name = str(target_row["canonical_name"])
        target_company_id = target_row["company_id"]

        # 3. Insert merge history record
        result = conn.execute(text("""
            INSERT INTO entity_merge_history
                (entity_type, source_id, target_id,
                 source_canonical_name, source_company_id,
                 target_canonical_name, target_company_id,
                 similarity_score, merged_by, previous_state)
            VALUES
                (:entity_type, :source_id, :target_id,
                 :source_name, :source_company_id,
                 :target_name, :target_company_id,
                 :similarity, :merged_by, :state)
            RETURNING id
        """), {
            "entity_type": entity_type,
            "source_id": source_id,
            "target_id": target_id,
            "source_name": source_name,
            "source_company_id": source_company_id,
            "target_name": target_name,
            "target_company_id": target_company_id,
            "similarity": similarity_score,
            "merged_by": merged_by,
            "state": json.dumps(snapshot),
        })
        merge_id = result.scalar()

        # 4. Delete the source entity
        conn.execute(
            text(f"DELETE FROM {quoted} WHERE id = :id"),
            {"id": source_id},
        )

    return MergeResult(
        merge_id=merge_id,
        entity_type=entity_type,
        source_id=source_id,
        source_name=source_name,
        target_id=target_id,
        target_name=target_name,
    ).model_dump()


# ── Undo Merge ────────────────────────────────────────────────────────────────

def undo_merge(
    merge_id: int,
    engine: Engine | None = None,
) -> dict:
    """
    Undo a previous merge by restoring the source entity from its snapshot.

    Args:
        merge_id: ID of the merge_history record to undo

    Returns:
        Dict with merge_id, status, and restored entity info
    """
    engine = engine or get_engine()

    with engine.begin() as conn:
        # 1. Fetch the merge record
        record = conn.execute(text(
            "SELECT * FROM entity_merge_history WHERE id = :id"
        ), {"id": merge_id}).mappings().first()

        if record is None:
            raise ValueError(f"Merge record {merge_id} not found.")

        if record["undone_at"] is not None:
            raise ValueError(f"Merge {merge_id} was already undone.")

        entity_type = record["entity_type"]
        previous_state = record["previous_state"]

        if entity_type not in RESOLVABLE_TABLES:
            raise ValueError(f"Invalid entity_type '{entity_type}' in merge record.")

        # 2. Parse the snapshot
        if isinstance(previous_state, str):
            snapshot = json.loads(previous_state)
        else:
            snapshot = previous_state

        if not snapshot:
            raise ValueError(f"Merge {merge_id} has no previous state to restore.")

        quoted = _quote_identifier(entity_type)

        # 3. Re-insert the source entity (exclude 'id' — let it auto-increment)
        cols = {k: v for k, v in snapshot.items() if k != "id"}
        if not cols:
            raise ValueError("No columns to restore.")

        col_names = list(cols.keys())
        quoted_cols = [_quote_identifier(c) for c in col_names]
        placeholders = [f":{c}" for c in col_names]

        conn.execute(text(
            f"INSERT INTO {quoted} ({', '.join(quoted_cols)}) "
            f"VALUES ({', '.join(placeholders)})"
        ), cols)

        # 4. Mark the merge as undone
        conn.execute(text(
            "UPDATE entity_merge_history SET undone_at = NOW() WHERE id = :id"
        ), {"id": merge_id})

    return {
        "merge_id": merge_id,
        "status": "undone",
        "entity_type": entity_type,
        "restored_name": snapshot.get("canonical_name", "unknown"),
    }


# ── Merge History ─────────────────────────────────────────────────────────────

def get_merge_history(
    entity_type: str | None = None,
    limit: int = 50,
    engine: Engine | None = None,
) -> list[dict]:
    """
    List merge history records, newest first.

    Args:
        entity_type: Optional filter by entity type
        limit: Maximum records to return

    Returns:
        List of MergeHistoryEntry dicts
    """
    engine = engine or get_engine()

    where_clause = ""
    params: dict[str, Any] = {"limit": limit}
    if entity_type:
        where_clause = "WHERE entity_type = :entity_type"
        params["entity_type"] = entity_type

    sql = f"""
        SELECT id, entity_type, source_id, source_canonical_name, source_company_id,
               target_id, target_canonical_name, target_company_id,
               similarity_score, merged_by, merged_at, undone_at
        FROM entity_merge_history
        {where_clause}
        ORDER BY merged_at DESC
        LIMIT :limit
    """

    entries = []
    try:
        with engine.connect() as conn:
            result = conn.execute(text(sql), params)
            for row in result:
                entries.append(MergeHistoryEntry(
                    id=row[0],
                    entity_type=row[1],
                    source_id=row[2],
                    source_canonical_name=row[3] or "unknown",
                    source_company_id=row[4],
                    target_id=row[5],
                    target_canonical_name=row[6] or "unknown",
                    target_company_id=row[7],
                    similarity_score=float(row[8]) if row[8] is not None else None,
                    merged_by=row[9] or "user",
                    merged_at=row[10].isoformat() if hasattr(row[10], "isoformat") else str(row[10]),
                    undone_at=row[11].isoformat() if row[11] and hasattr(row[11], "isoformat") else None,
                ).model_dump())
    except (ProgrammingError, OperationalError) as e:
        logger.warning(f"Failed to fetch merge history: {e}")

    return entries
