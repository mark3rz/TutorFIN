"""
pipeline/embeddings.py — Vector embedding generation for DataArch.AI.

Generates vector embeddings for entity data and stores them in PostgreSQL
using the pgvector extension. Supports Voyage AI for embedding generation.

Phase 3, Step 3.1

Features:
  - Installs pgvector extension and adds embedding columns to tables
  - Converts entity data to text for embedding
  - Batch embedding generation via Voyage AI
  - Stores embeddings alongside structured data in PostgreSQL
  - Fallback: can run without Voyage API key (skips embedding)
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import ProgrammingError, OperationalError

import config
from pipeline.database import get_engine, _quote_identifier
from pipeline.schema_generator import load_registry, _table_name, _sanitize_column_name
from pipeline.ontology.schema import EntityRegistry, OntologyType

logger = logging.getLogger(__name__)

# ── Text representation for embedding ───────────────────────────────────────

def entity_to_text(record) -> str:
    """
    Convert an entity record to a text representation for embedding.

    Combines the canonical name, type, company context, and all attributes
    into a single text string that captures the entity's semantic meaning.

    Phase 5: includes company_slug for portfolio-aware embeddings.
    """
    parts = [
        f"Type: {record.ontology_type.value}",
        f"Name: {record.canonical_name}",
    ]

    # Phase 5: include company context if available
    if getattr(record, "company_slug", None):
        parts.append(f"Company: {record.company_slug}")

    if record.aliases:
        parts.append(f"Also known as: {', '.join(record.aliases)}")

    if record.attributes:
        attr_parts = []
        for key, value in record.attributes.items():
            attr_parts.append(f"{key}: {value}")
        parts.append("Attributes: " + "; ".join(attr_parts))

    if record.source_file:
        parts.append(f"Source: {record.source_file}")

    return ". ".join(parts)


# ── Voyage AI embedding client ──────────────────────────────────────────────

def _get_voyage_client():
    """Get or create a Voyage AI client."""
    try:
        import voyageai
    except ImportError:
        raise ImportError(
            "voyageai package not installed. Install with: pip install voyageai"
        )

    api_key = config.VOYAGE_API_KEY
    if not api_key:
        raise EnvironmentError(
            "VOYAGE_API_KEY not set. Get a key at https://dash.voyageai.com/ "
            "and add it to your .env file."
        )

    return voyageai.Client(api_key=api_key)


def generate_embeddings(
    texts: list[str],
    model: str | None = None,
    input_type: str = "document",
) -> list[list[float]]:
    """
    Generate vector embeddings for a list of texts using Voyage AI.

    Args:
        texts: List of text strings to embed
        model: Embedding model name (defaults to config.EMBEDDING_MODEL)
        input_type: Voyage AI input type — "document" when indexing entity data,
                    "query" when embedding a search query. Using the correct type
                    is critical for retrieval quality.

    Returns:
        List of embedding vectors (each is a list of floats)
    """
    model = model or config.EMBEDDING_MODEL
    client = _get_voyage_client()

    # Voyage AI supports batches up to 128 texts
    all_embeddings = []
    batch_size = 128

    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        logger.info(f"Embedding batch {i // batch_size + 1} ({len(batch)} texts, input_type={input_type})")

        result = client.embed(
            texts=batch,
            model=model,
            input_type=input_type,
        )
        all_embeddings.extend(result.embeddings)

    return all_embeddings


# ── Database setup for pgvector ─────────────────────────────────────────────

def setup_pgvector(engine: Engine | None = None) -> dict:
    """
    Set up pgvector extension and add embedding columns to all entity tables.

    Returns:
        {"extension_created": bool, "columns_added": [...], "errors": [...]}
    """
    engine = engine or get_engine()
    dim = config.EMBEDDING_DIMENSION
    results = {
        "extension_created": False,
        "columns_added": [],
        "errors": [],
    }

    with engine.begin() as conn:
        # Create pgvector extension
        try:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            results["extension_created"] = True
            logger.info("pgvector extension ready.")
        except (ProgrammingError, OperationalError) as e:
            results["errors"].append(f"Failed to create pgvector extension: {e}")
            logger.error(f"pgvector setup failed: {e}")
            return results

        # Get list of existing tables
        table_result = conn.execute(text(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'public'"
        ))
        existing_tables = {row[0] for row in table_result}

        # Add embedding column to each entity table
        entity_tables = [
            "vendor", "customer", "employee", "product",
            "transaction", "contract", "financial_record", "business_unit",
        ]

        for table in entity_tables:
            if table not in existing_tables:
                continue

            quoted = _quote_identifier(table)
            try:
                # Check if column already exists
                col_check = conn.execute(text(
                    f"SELECT column_name FROM information_schema.columns "
                    f"WHERE table_name = :table AND column_name = 'embedding'"
                ), {"table": table})

                if col_check.fetchone() is None:
                    conn.execute(text(
                        f"ALTER TABLE {quoted} ADD COLUMN embedding vector({dim})"
                    ))
                    results["columns_added"].append(table)
                    logger.info(f"Added embedding column to '{table}'.")
                else:
                    logger.info(f"Embedding column already exists in '{table}'.")

            except (ProgrammingError, OperationalError) as e:
                results["errors"].append(f"Failed to add embedding to '{table}': {e}")
                logger.error(f"Failed to add embedding column to '{table}': {e}")

    return results


# ── Embed and store ─────────────────────────────────────────────────────────

def embed_all_entities(
    registry: EntityRegistry | None = None,
    engine: Engine | None = None,
    company_id: int | None = None,
) -> dict:
    """
    Generate embeddings for all entities and store them in PostgreSQL.

    Process:
      1. Load entity registry
      2. Convert each entity to text
      3. Generate embeddings via Voyage AI
      4. UPDATE each row's embedding column in PostgreSQL

    Args:
        registry: Entity registry (loads from disk if None)
        engine: SQLAlchemy engine (uses default if None)
        company_id: If set, scope UPDATE to match on both canonical_name
                    and company_id (Phase 5)

    Returns:
        {
            "total_entities": 23,
            "embedded": 21,
            "failed": 2,
            "errors": [...],
        }
    """
    if registry is None:
        registry = load_registry()

    engine = engine or get_engine()

    # Filter out UNKNOWN entities
    entities = [
        (eid, record) for eid, record in registry.entries.items()
        if record.ontology_type != OntologyType.UNKNOWN
    ]

    if not entities:
        return {"total_entities": 0, "embedded": 0, "failed": 0, "errors": []}

    # Convert entities to text
    entity_texts = [entity_to_text(record) for _, record in entities]

    # Generate embeddings
    logger.info(f"Generating embeddings for {len(entity_texts)} entities...")
    try:
        embeddings = generate_embeddings(entity_texts)
    except Exception as e:
        logger.error(f"Embedding generation failed: {e}")
        return {
            "total_entities": len(entities),
            "embedded": 0,
            "failed": len(entities),
            "errors": [f"Embedding generation failed: {e}"],
        }

    # Store embeddings in database
    results = {
        "total_entities": len(entities),
        "embedded": 0,
        "failed": 0,
        "errors": [],
    }

    with engine.begin() as conn:
        for (eid, record), embedding in zip(entities, embeddings):
            table = _table_name(record.ontology_type)
            quoted = _quote_identifier(table)

            try:
                # Format embedding as PostgreSQL vector string
                vec_str = "[" + ",".join(str(v) for v in embedding) + "]"

                # Phase 5: scope UPDATE to company_id when set
                if company_id is not None:
                    conn.execute(text(
                        f"UPDATE {quoted} SET embedding = :vec "
                        f"WHERE canonical_name = :name AND company_id = :company_id"
                    ), {"vec": vec_str, "name": record.canonical_name,
                        "company_id": company_id})
                else:
                    conn.execute(text(
                        f"UPDATE {quoted} SET embedding = :vec "
                        f"WHERE canonical_name = :name AND company_id IS NULL"
                    ), {"vec": vec_str, "name": record.canonical_name})

                results["embedded"] += 1
            except Exception as e:
                results["failed"] += 1
                results["errors"].append(
                    f"Failed to store embedding for '{record.canonical_name}': {e}"
                )

    logger.info(
        f"Embedding complete: {results['embedded']} stored, "
        f"{results['failed']} failed out of {results['total_entities']}."
    )

    return results
