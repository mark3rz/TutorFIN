"""
schema.py — Core data models for DataArch.AI parsed document output.

Every parser produces a ParsedDocument. This is the contract between
the ingestion pipeline and everything downstream (ontology mapper,
schema generator, API responses).
"""

from __future__ import annotations
from enum import Enum
from typing import Any
from pydantic import BaseModel, Field
from datetime import datetime


class DocumentType(str, Enum):
    PDF   = "pdf"
    EXCEL = "excel"
    DOCX  = "docx"
    EMAIL = "email"
    UNKNOWN = "unknown"


class ExtractionStatus(str, Enum):
    SUCCESS = "success"
    PARTIAL = "partial"   # parsed but LLM extraction incomplete
    FAILED  = "failed"


class BusinessEntity(BaseModel):
    """A named business object extracted from the document."""
    entity_type: str           # e.g. "invoice", "contract", "vendor", "employee"
    name: str | None = None
    attributes: dict[str, Any] = Field(default_factory=dict)
    confidence: float = Field(ge=0.0, le=1.0, default=1.0)


class DocumentMetadata(BaseModel):
    filename: str
    file_type: DocumentType
    file_size_bytes: int
    page_count: int | None = None      # PDF / DOCX
    sheet_count: int | None = None     # Excel
    parsed_at: datetime = Field(default_factory=datetime.utcnow)
    source_path: str


class ParsedDocument(BaseModel):
    """
    The canonical output of any DataArch parser.
    Downstream stages (ontology mapper, schema generator) consume this.
    """
    metadata: DocumentMetadata
    status: ExtractionStatus

    # Raw text extracted before LLM processing
    raw_text: str = ""

    # LLM-extracted structured data
    entities: list[BusinessEntity] = Field(default_factory=list)
    summary: str = ""                          # one-paragraph human summary
    data_fields: dict[str, Any] = Field(default_factory=dict)  # key-value pairs

    # Any errors encountered
    errors: list[str] = Field(default_factory=list)

    def to_output_dict(self) -> dict:
        return self.model_dump(mode="json")
