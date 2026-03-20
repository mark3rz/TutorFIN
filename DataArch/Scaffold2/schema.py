"""
pipeline/ontology/schema.py — Canonical business object models for DataArch.AI.

These are the normalised types that every parsed document gets mapped to,
regardless of source system or company. A "vendor" in NetSuite, a "supplier"
in a PDF invoice, and a "counterparty" in a contract all become a Vendor here.
"""

from __future__ import annotations
from enum import Enum
from typing import Any
from pydantic import BaseModel, Field
from datetime import datetime


class OntologyType(str, Enum):
    VENDOR          = "vendor"
    CUSTOMER        = "customer"
    EMPLOYEE        = "employee"
    PRODUCT         = "product"
    TRANSACTION     = "transaction"
    CONTRACT        = "contract"
    FINANCIAL_RECORD = "financial_record"
    BUSINESS_UNIT   = "business_unit"
    UNKNOWN         = "unknown"


class MappingConfidence(str, Enum):
    HIGH    = "high"     # clear match, >0.85
    MEDIUM  = "medium"   # probable match, 0.60–0.85
    LOW     = "low"      # weak signal, <0.60


class OntologyRecord(BaseModel):
    """
    A single normalised business object extracted and classified from a document.
    This is the atomic unit consumed by the schema generator and data flow mapper.
    """
    id: str                              # stable hash of (source_file + raw_name)
    ontology_type: OntologyType
    confidence: MappingConfidence

    # Human-readable identity
    canonical_name: str                  # normalised name (e.g. "Acme Corp")
    aliases: list[str] = Field(default_factory=list)   # other names seen for this entity

    # Source traceability
    source_file: str
    source_entity_type: str              # what the parser originally called it
    source_attributes: dict[str, Any] = Field(default_factory=dict)

    # Normalised attributes (type-specific, populated by classifier)
    attributes: dict[str, Any] = Field(default_factory=dict)

    # Lineage
    mapped_at: datetime = Field(default_factory=datetime.utcnow)
    mapping_notes: str = ""


class OntologyResult(BaseModel):
    """
    Full output of mapping a single ParsedDocument through the ontology mapper.
    """
    source_file: str
    records: list[OntologyRecord] = Field(default_factory=list)
    unmapped_count: int = 0        # entities that couldn't be confidently mapped
    mapped_at: datetime = Field(default_factory=datetime.utcnow)

    def to_output_dict(self) -> dict:
        return self.model_dump(mode="json")


class EntityRegistry(BaseModel):
    """
    Cross-document index of all unique canonical entities seen so far.
    Enables deduplication across multiple files from the same company.
    """
    entries: dict[str, OntologyRecord] = Field(default_factory=dict)  # id → record
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    def upsert(self, record: OntologyRecord) -> None:
        """Add or merge a record. Merges aliases if entity already known."""
        if record.id in self.entries:
            existing = self.entries[record.id]
            merged_aliases = list(set(existing.aliases + record.aliases + [record.canonical_name]))
            existing.aliases = [a for a in merged_aliases if a != existing.canonical_name]
        else:
            self.entries[record.id] = record
        self.updated_at = datetime.utcnow()

    def to_output_dict(self) -> dict:
        return self.model_dump(mode="json")
