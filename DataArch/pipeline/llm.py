"""
pipeline/llm.py — Structured LLM integration for DataArch.AI.

All parsers call extract() with their raw text.
Swap the model or provider here without touching parsers.

Phase 1 improvements:
  - Structured output via Claude tool_use (not free-text JSON)
  - Pydantic validation of all LLM responses
  - Retry logic with exponential backoff (3 attempts)
  - Configurable model via DATAARCH_MODEL env var
  - Smart document chunking with overlap for long documents
  - Document-type-specific extraction prompts
"""

import json
import time
import logging
from typing import Any

import anthropic
from pydantic import BaseModel, Field, ValidationError

import config
from pipeline.client import get_anthropic_client

logger = logging.getLogger(__name__)

# ── Configuration ────────────────────────────────────────────────────────────

# Model sourced from config.py (reads DATAARCH_MODEL env var)
MODEL = config.DATAARCH_MODEL

# Chunking settings
CHUNK_SIZE = 8000        # characters per chunk
CHUNK_OVERLAP = 500      # overlap between chunks
MAX_RETRIES = 3          # retry attempts for LLM calls
RETRY_BASE_DELAY = 1.0   # base delay in seconds (exponential backoff)

def _get_client() -> anthropic.Anthropic:
    """Thin wrapper — delegates to the shared client factory in pipeline/client.py."""
    return get_anthropic_client()


# ── Pydantic models for LLM response validation ─────────────────────────────

class ExtractedEntity(BaseModel):
    """A single entity extracted from a document by the LLM."""
    entity_type: str
    name: str | None = None
    attributes: dict[str, Any] = Field(default_factory=dict)
    confidence: float = Field(ge=0.0, le=1.0, default=0.5)


class ExtractionResult(BaseModel):
    """Validated extraction result from the LLM."""
    summary: str = ""
    entities: list[ExtractedEntity] = Field(default_factory=list)
    data_fields: dict[str, Any] = Field(default_factory=dict)


# ── Tool definitions for Claude tool_use ─────────────────────────────────────

EXTRACTION_TOOL = {
    "name": "extract_document_data",
    "description": (
        "Extract structured business entities and data fields from a document. "
        "Call this tool with all the entities and data you find in the text."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "summary": {
                "type": "string",
                "description": "One paragraph describing what this document is about.",
            },
            "entities": {
                "type": "array",
                "description": "All business entities found in the document.",
                "items": {
                    "type": "object",
                    "properties": {
                        "entity_type": {
                            "type": "string",
                            "enum": [
                                "invoice", "contract", "vendor", "employee",
                                "customer", "product", "financial_record",
                                "transaction", "business_unit", "other",
                            ],
                            "description": "The type of business entity.",
                        },
                        "name": {
                            "type": "string",
                            "description": "Primary name or identifier of the entity.",
                        },
                        "attributes": {
                            "type": "object",
                            "description": "Key-value pairs of entity attributes.",
                            "additionalProperties": {"type": "string"},
                        },
                        "confidence": {
                            "type": "number",
                            "minimum": 0.0,
                            "maximum": 1.0,
                            "description": "Confidence score for this extraction (0.0–1.0).",
                        },
                    },
                    "required": ["entity_type", "name"],
                },
            },
            "data_fields": {
                "type": "object",
                "description": "Additional data fields extracted from the document (dates, amounts, IDs, etc.).",
                "additionalProperties": {"type": "string"},
            },
        },
        "required": ["summary", "entities", "data_fields"],
    },
}

# Document-type-specific system prompts
SYSTEM_PROMPTS = {
    "default": (
        "You are a data extraction engine for DataArch.AI, a Private Equity data platform. "
        "Extract every meaningful business entity and data point from the document text. "
        "Use the extract_document_data tool to return your results."
    ),
    "invoice": (
        "You are a data extraction engine for DataArch.AI, specialized in financial documents. "
        "Extract all invoice details: vendor, customer, line items, amounts, dates, payment terms, "
        "PO numbers, tax amounts, and any other financial data. "
        "Use the extract_document_data tool to return your results."
    ),
    "contract": (
        "You are a data extraction engine for DataArch.AI, specialized in legal/contract documents. "
        "Extract all parties, effective dates, expiry dates, renewal terms, contract value, "
        "SLA terms, obligations, and any referenced business entities. "
        "Use the extract_document_data tool to return your results."
    ),
    "financial_statement": (
        "You are a data extraction engine for DataArch.AI, specialized in financial statements. "
        "Extract all line items, periods, totals, subtotals, ratios, and any entities referenced. "
        "Identify the type of statement (P&L, balance sheet, trial balance, etc.). "
        "Use the extract_document_data tool to return your results."
    ),
    "hr_document": (
        "You are a data extraction engine for DataArch.AI, specialized in HR documents. "
        "Extract all employees, roles, departments, compensation data, org structure, "
        "and business units. Use the extract_document_data tool to return your results."
    ),
}


# ── Smart chunking ──────────────────────────────────────────────────────────

def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """
    Split long text into overlapping chunks for processing.

    Returns a list of text chunks. Short texts return a single chunk.
    Each chunk overlaps with the next by `overlap` characters to avoid
    losing entities that span chunk boundaries.
    """
    if len(text) <= chunk_size:
        return [text]

    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size

        # Try to break at a natural boundary (newline, period, space)
        if end < len(text):
            # Look for a good break point in the last 200 chars of the chunk
            search_start = max(end - 200, start)
            best_break = end

            # Prefer paragraph breaks
            nl_pos = text.rfind("\n\n", search_start, end)
            if nl_pos > search_start:
                best_break = nl_pos + 2
            else:
                # Try single newline
                nl_pos = text.rfind("\n", search_start, end)
                if nl_pos > search_start:
                    best_break = nl_pos + 1
                else:
                    # Try period
                    period_pos = text.rfind(". ", search_start, end)
                    if period_pos > search_start:
                        best_break = period_pos + 2
                    else:
                        # Try space
                        space_pos = text.rfind(" ", search_start, end)
                        if space_pos > search_start:
                            best_break = space_pos + 1

            end = best_break

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)

        # Move forward, accounting for overlap
        start = end - overlap if end < len(text) else len(text)

    return chunks


def _merge_extraction_results(results: list[ExtractionResult]) -> ExtractionResult:
    """
    Merge extraction results from multiple chunks into a single result.
    Deduplicates entities by name + type.
    """
    if len(results) == 1:
        return results[0]

    # Merge summaries
    summaries = [r.summary for r in results if r.summary]
    merged_summary = " ".join(summaries) if summaries else ""

    # Merge and deduplicate entities
    seen_entities: dict[str, ExtractedEntity] = {}
    for result in results:
        for entity in result.entities:
            # Dedup key: lowercase name + type
            key = f"{(entity.name or '').lower().strip()}::{entity.entity_type}"
            if key not in seen_entities:
                seen_entities[key] = entity
            else:
                # Keep the one with higher confidence
                existing = seen_entities[key]
                if entity.confidence > existing.confidence:
                    seen_entities[key] = entity
                # Merge attributes
                existing_attrs = seen_entities[key].attributes
                for k, v in entity.attributes.items():
                    if k not in existing_attrs:
                        existing_attrs[k] = v

    # Merge data fields
    merged_fields: dict[str, Any] = {}
    for result in results:
        for k, v in result.data_fields.items():
            if k not in merged_fields:
                merged_fields[k] = v

    return ExtractionResult(
        summary=merged_summary,
        entities=list(seen_entities.values()),
        data_fields=merged_fields,
    )


# ── Retry wrapper ───────────────────────────────────────────────────────────

def _call_with_retry(func, *args, max_retries: int = MAX_RETRIES, **kwargs):
    """
    Call a function with exponential backoff retry on transient errors.
    """
    last_error = None
    for attempt in range(max_retries):
        try:
            return func(*args, **kwargs)
        except (anthropic.RateLimitError, anthropic.APIConnectionError, anthropic.InternalServerError) as e:
            last_error = e
            if attempt < max_retries - 1:
                delay = RETRY_BASE_DELAY * (2 ** attempt)
                logger.warning(
                    f"LLM call failed (attempt {attempt + 1}/{max_retries}): {e}. "
                    f"Retrying in {delay}s..."
                )
                time.sleep(delay)
            else:
                logger.error(f"LLM call failed after {max_retries} attempts: {e}")
        except (anthropic.BadRequestError, anthropic.AuthenticationError) as e:
            # Non-transient errors — don't retry
            raise
    raise last_error


# ── Main extraction function ────────────────────────────────────────────────

def _detect_document_type(text: str) -> str:
    """
    Simple heuristic to detect document type for prompt selection.
    Returns a key into SYSTEM_PROMPTS.
    """
    lower = text[:3000].lower()

    if any(kw in lower for kw in ["invoice", "bill to", "remit to", "payment due", "subtotal", "total due"]):
        return "invoice"
    if any(kw in lower for kw in ["agreement", "contract", "hereby", "whereas", "parties", "effective date"]):
        return "contract"
    if any(kw in lower for kw in ["balance sheet", "income statement", "profit and loss", "p&l",
                                    "trial balance", "general ledger", "fiscal year"]):
        return "financial_statement"
    if any(kw in lower for kw in ["employee", "headcount", "department", "compensation",
                                    "org chart", "human resources", "hr "]):
        return "hr_document"
    return "default"


def _extract_chunk(text: str, doc_type: str, max_tokens: int = 2048) -> ExtractionResult:
    """
    Extract structured data from a single text chunk using Claude tool_use.
    Returns a validated ExtractionResult.
    """
    client = _get_client()
    system_prompt = SYSTEM_PROMPTS.get(doc_type, SYSTEM_PROMPTS["default"])

    def _make_call():
        return client.messages.create(
            model=MODEL,
            max_tokens=max_tokens,
            system=system_prompt,
            tools=[EXTRACTION_TOOL],
            tool_choice={"type": "tool", "name": "extract_document_data"},
            messages=[
                {
                    "role": "user",
                    "content": f"Extract all business entities and data from this document text:\n\n{text}",
                }
            ],
        )

    message = _call_with_retry(_make_call)

    # Parse tool_use response
    for block in message.content:
        if block.type == "tool_use" and block.name == "extract_document_data":
            try:
                return ExtractionResult(**block.input)
            except ValidationError as e:
                logger.warning(f"LLM response validation failed: {e}. Using partial data.")
                # Try to salvage what we can
                raw = block.input
                return ExtractionResult(
                    summary=raw.get("summary", ""),
                    entities=[
                        ExtractedEntity(**ent) for ent in raw.get("entities", [])
                        if isinstance(ent, dict) and "entity_type" in ent
                    ],
                    data_fields=raw.get("data_fields", {}),
                )

    # Fallback: if no tool_use block found, try to parse text response
    logger.warning("No tool_use block in response, attempting text parsing fallback.")
    return _extract_text_fallback(message)


def _extract_text_fallback(message) -> ExtractionResult:
    """
    Fallback parser for when Claude doesn't use the tool.
    Attempts to parse JSON from the text response.
    """
    for block in message.content:
        if hasattr(block, "text"):
            text = block.text.strip()
            if text.startswith("```"):
                lines = text.split("\n")
                text = "\n".join(lines[1:-1])
            try:
                data = json.loads(text)
                return ExtractionResult(**data)
            except (json.JSONDecodeError, ValidationError):
                pass

    # Return empty result if all parsing fails
    logger.error("Could not parse LLM response. Returning empty extraction.")
    return ExtractionResult()


def extract(raw_text: str, max_tokens: int = 2048) -> dict:
    """
    Send raw document text to Claude and return structured extraction.

    Handles long documents by chunking with overlap, extracting from
    each chunk, then merging and deduplicating results.

    Returns a dict matching the ExtractionResult schema.
    """
    doc_type = _detect_document_type(raw_text)
    chunks = chunk_text(raw_text)

    if len(chunks) > 1:
        logger.info(f"Document split into {len(chunks)} chunks (type: {doc_type})")

    results = []
    for i, chunk in enumerate(chunks):
        if len(chunks) > 1:
            logger.info(f"Processing chunk {i + 1}/{len(chunks)} ({len(chunk)} chars)")
        result = _extract_chunk(chunk, doc_type, max_tokens)
        results.append(result)

    merged = _merge_extraction_results(results)
    return merged.model_dump()


# ── Legacy compatibility ────────────────────────────────────────────────────

# These are preserved so existing parser code doesn't break.
# The EXTRACTION_PROMPT is no longer used for tool_use mode, but kept
# in case any downstream code references it.
EXTRACTION_PROMPT = """You are a data extraction engine for DataArch.AI.
Given raw text from a business document, extract structured information.

Return ONLY valid JSON with this exact shape:
{{
  "summary": "<one paragraph describing what this document is>",
  "entities": [
    {{
      "entity_type": "<invoice|contract|vendor|employee|customer|product|financial_record|other>",
      "name": "<primary name or identifier, or null>",
      "attributes": {{ "<key>": "<value>" }},
      "confidence": <0.0-1.0>
    }}
  ],
  "data_fields": {{
    "<field_name>": "<extracted value>"
  }}
}}

Rules:
- Extract every meaningful business entity and data point.
- For data_fields, include things like dates, amounts, IDs, names, statuses.
- confidence reflects how certain you are about each entity.
- Return only JSON — no explanation, no markdown.

Document text:
{text}
"""
