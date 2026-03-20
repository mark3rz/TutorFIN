"""
parsers/pdf.py — PDF ingestion and extraction.
Uses PyMuPDF for text extraction, Claude for structured data.
"""

import fitz  # PyMuPDF
from pathlib import Path
from pipeline.schema import ParsedDocument, DocumentMetadata, DocumentType, ExtractionStatus, BusinessEntity
from pipeline import llm


def parse(file_path: Path) -> ParsedDocument:
    metadata = DocumentMetadata(
        filename=file_path.name,
        file_type=DocumentType.PDF,
        file_size_bytes=file_path.stat().st_size,
        source_path=str(file_path),
    )

    errors = []
    raw_text = ""

    try:
        doc = fitz.open(str(file_path))
        metadata.page_count = len(doc)
        raw_text = "\n".join(page.get_text() for page in doc)
        doc.close()
    except Exception as e:
        errors.append(f"PDF parse error: {e}")
        return ParsedDocument(
            metadata=metadata,
            status=ExtractionStatus.FAILED,
            errors=errors,
        )

    if not raw_text.strip():
        errors.append("No extractable text found — document may be scanned/image-based.")
        return ParsedDocument(
            metadata=metadata,
            status=ExtractionStatus.FAILED,
            raw_text=raw_text,
            errors=errors,
        )

    try:
        extracted = llm.extract(raw_text)
        entities = [BusinessEntity(**e) for e in extracted.get("entities", [])]
        return ParsedDocument(
            metadata=metadata,
            status=ExtractionStatus.SUCCESS,
            raw_text=raw_text,
            entities=entities,
            summary=extracted.get("summary", ""),
            data_fields=extracted.get("data_fields", {}),
            errors=errors,
        )
    except Exception as e:
        errors.append(f"LLM extraction error: {e}")
        return ParsedDocument(
            metadata=metadata,
            status=ExtractionStatus.PARTIAL,
            raw_text=raw_text,
            errors=errors,
        )
