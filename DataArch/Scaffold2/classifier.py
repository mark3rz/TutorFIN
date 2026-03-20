"""
pipeline/ontology/classifier.py — LLM-powered entity → ontology type mapper.

Takes a BusinessEntity from a ParsedDocument and asks Claude to classify it
into the PE business ontology, extracting normalised attributes in the process.
"""

import json
from pipeline.ontology.schema import OntologyType, MappingConfidence

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
    Ask Claude to classify a single entity into the PE ontology.
    Returns the parsed JSON dict from Claude.
    """
    prompt = CLASSIFY_PROMPT.format(
        ontology_spec=ONTOLOGY_SPEC,
        entity_type=entity_type,
        entity_name=entity_name or "(unnamed)",
        entity_attributes=json.dumps(entity_attributes, indent=2),
    )

    message = llm_client.messages.create(
        model="claude-opus-4-5",
        max_tokens=800,
        messages=[{"role": "user", "content": prompt}],
    )

    response_text = message.content[0].text.strip()
    if response_text.startswith("```"):
        lines = response_text.split("\n")
        response_text = "\n".join(lines[1:-1])

    return json.loads(response_text)


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
