"""
pipeline/ontology/classifier.py — LLM-powered entity → ontology type mapper.

Takes a BusinessEntity from a ParsedDocument and asks Claude to classify it
into the PE business ontology, extracting normalised attributes in the process.

Phase 1 improvements:
  - Structured output via Claude tool_use (not free-text JSON)
  - Pydantic validation of classification response
  - Uses retry wrapper from pipeline.llm
"""

import json
import logging
from typing import Any

from pydantic import BaseModel, Field, ValidationError

from pipeline.ontology.schema import OntologyType, MappingConfidence

logger = logging.getLogger(__name__)

# The PE ontology types with examples of raw names that map to each.
# This is included verbatim in the prompt to ground the LLM.
ONTOLOGY_SPEC = """
PE Business Ontology — canonical types and example raw names:

VENDOR
  Examples: supplier, counterparty, service provider, contractor, subcontractor,
            payee, merchant, vendor, fulfillment partner
  Key attributes: vendor_id, legal_name, payment_terms, category

CUSTOMER
  Examples: client, account, buyer, end customer, subscriber, billable entity
  Key attributes: customer_id, legal_name, segment, revenue_tier

EMPLOYEE
  Examples: staff member, headcount, team member, payee (HR), contractor (HR)
  Key attributes: employee_id, role, department, compensation_band

PRODUCT
  Examples: SKU, line item, service offering, subscription tier, good, material
  Key attributes: product_id, name, unit_price, category, revenue_type

TRANSACTION
  Examples: invoice, payment, purchase order, bill, receipt, wire transfer,
            expense, charge, credit note, debit, journal entry
  Key attributes: transaction_id, amount, currency, date, counterparty, direction

CONTRACT
  Examples: agreement, MSA, SOW, lease, NDA, license, SLA, amendment, addendum
  Key attributes: contract_id, parties, effective_date, expiry_date, value, type

FINANCIAL_RECORD
  Examples: P&L, balance sheet, income statement, trial balance, budget,
            forecast, general ledger, chart of accounts
  Key attributes: period, record_type, total_value, currency

BUSINESS_UNIT
  Examples: division, department, subsidiary, entity, location, plant, region
  Key attributes: unit_id, name, parent_entity, headcount

UNKNOWN
  Use when the entity cannot be confidently classified into any of the above.
"""


# ── Tool definition for classification ───────────────────────────────────────

CLASSIFICATION_TOOL = {
    "name": "classify_business_entity",
    "description": (
        "Classify a business entity into the PE business ontology. "
        "Determine the entity type, confidence level, and extract normalised attributes."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "ontology_type": {
                "type": "string",
                "enum": [
                    "vendor", "customer", "employee", "product",
                    "transaction", "contract", "financial_record",
                    "business_unit", "unknown",
                ],
                "description": "The PE ontology type this entity belongs to.",
            },
            "confidence": {
                "type": "string",
                "enum": ["high", "medium", "low"],
                "description": "How confident you are in this classification.",
            },
            "canonical_name": {
                "type": "string",
                "description": "Clean, normalised name for this entity (e.g. 'Acme Corporation', not 'ACME CORP.').",
            },
            "aliases": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Other names this entity goes by. Include the original raw name if it differs from canonical_name.",
            },
            "attributes": {
                "type": "object",
                "description": "Type-specific key-value attributes using the key names from the ontology spec.",
                "additionalProperties": {"type": "string"},
            },
            "mapping_notes": {
                "type": "string",
                "description": "One sentence explaining why you chose this type, or noting any ambiguity.",
            },
        },
        "required": ["ontology_type", "confidence", "canonical_name", "attributes"],
    },
}


# ── Pydantic model for validated classification ──────────────────────────────

class ClassificationResult(BaseModel):
    """Validated classification result from the LLM."""
    ontology_type: str
    confidence: str
    canonical_name: str
    aliases: list[str] = Field(default_factory=list)
    attributes: dict[str, Any] = Field(default_factory=dict)
    mapping_notes: str = ""


# ── Classification system prompt ─────────────────────────────────────────────

CLASSIFICATION_SYSTEM = f"""You are a data architecture expert classifying business entities
into a Private Equity business ontology.

{ONTOLOGY_SPEC}

Rules:
- canonical_name should be a clean, deduplicated name (e.g. 'Acme Corporation', not 'ACME CORP.')
- aliases should include the original raw name if it differs from canonical_name
- attributes should use the key names listed in the ontology spec for the chosen type
- Only include attributes that are actually present in the source data
- Use the classify_business_entity tool to return your classification."""

# Legacy prompt kept for reference / fallback
CLASSIFY_PROMPT = """You are a data architecture expert classifying business entities
into a Private Equity business ontology.

{ontology_spec}

Given the entity below, return ONLY valid JSON:
{{
  "ontology_type": "<one of: vendor|customer|employee|product|transaction|contract|financial_record|business_unit|unknown>",
  "confidence": "<high|medium|low>",
  "canonical_name": "<clean, normalised name for this entity>",
  "aliases": ["<other names this entity goes by, if any>"],
  "attributes": {{
    "<type-specific key>": "<extracted value>"
  }},
  "mapping_notes": "<one sentence explaining why you chose this type, or any ambiguity>"
}}

Rules:
- canonical_name should be a clean, deduplicated name (e.g. 'Acme Corporation', not 'ACME CORP.')
- aliases should include the original raw name if it differs from canonical_name
- attributes should use the key names listed in the ontology spec for the chosen type
- Only include attributes that are actually present in the source data
- Return only JSON — no explanation, no markdown

Entity to classify:
type: {entity_type}
name: {entity_name}
attributes: {entity_attributes}
"""


def classify_entity(
    entity_type: str,
    entity_name: str | None,
    entity_attributes: dict,
    llm_client,
) -> dict:
    """
    Ask Claude to classify a single entity into the PE ontology using tool_use.
    Returns the parsed classification dict.
    """
    from pipeline.llm import MODEL, _call_with_retry

    user_message = (
        f"Classify this business entity into the PE ontology:\n\n"
        f"Type: {entity_type}\n"
        f"Name: {entity_name or '(unnamed)'}\n"
        f"Attributes: {json.dumps(entity_attributes, indent=2)}"
    )

    def _make_call():
        return llm_client.messages.create(
            model=MODEL,
            max_tokens=800,
            system=CLASSIFICATION_SYSTEM,
            tools=[CLASSIFICATION_TOOL],
            tool_choice={"type": "tool", "name": "classify_business_entity"},
            messages=[{"role": "user", "content": user_message}],
        )

    message = _call_with_retry(_make_call)

    # Parse tool_use response
    for block in message.content:
        if block.type == "tool_use" and block.name == "classify_business_entity":
            try:
                validated = ClassificationResult(**block.input)
                return validated.model_dump()
            except ValidationError as e:
                logger.warning(f"Classification validation failed: {e}. Using raw data.")
                return block.input

    # Fallback: try to parse text response
    logger.warning("No tool_use block in classification response, trying text fallback.")
    return _classify_text_fallback(message, entity_name)


def _classify_text_fallback(message, entity_name: str | None) -> dict:
    """
    Fallback parser for when Claude doesn't use the tool.
    """
    for block in message.content:
        if hasattr(block, "text"):
            text = block.text.strip()
            if text.startswith("```"):
                lines = text.split("\n")
                text = "\n".join(lines[1:-1])
            try:
                data = json.loads(text)
                return data
            except json.JSONDecodeError:
                pass

    # Return unknown classification if all parsing fails
    logger.error(f"Could not parse classification for '{entity_name}'. Returning UNKNOWN.")
    return {
        "ontology_type": "unknown",
        "confidence": "low",
        "canonical_name": entity_name or "unnamed",
        "aliases": [],
        "attributes": {},
        "mapping_notes": "Classification failed — could not parse LLM response.",
    }


def confidence_from_str(s: str) -> MappingConfidence:
    mapping = {
        "high": MappingConfidence.HIGH,
        "medium": MappingConfidence.MEDIUM,
        "low": MappingConfidence.LOW,
    }
    return mapping.get(s.lower(), MappingConfidence.LOW)


def ontology_type_from_str(s: str) -> OntologyType:
    try:
        return OntologyType(s.lower())
    except ValueError:
        return OntologyType.UNKNOWN
