"""
parsers/email.py — Email (.eml) ingestion and extraction.
Uses Python's built-in email module, Claude for structured data.
"""

import email
from email import policy
from pathlib import Path
from pipeline.schema import ParsedDocument, DocumentMetadata, DocumentType, ExtractionStatus, BusinessEntity
from pipeline import llm


def _eml_to_text(file_path: Path) -> str:
    with open(file_path, "rb") as f:
        msg = email.message_from_binary_file(f, policy=policy.default)

    lines = [
        f"From: {msg.get('From', '')}",
        f"To: {msg.get('To', '')}",
        f"Subject: {msg.get('Subject', '')}",
        f"Date: {msg.get('Date', '')}",
        "",
    ]

    # Extract plain text body parts
    for part in msg.walk():
        content_type = part.get_content_type()
        if content_type == "text/plain":
            try:
                lines.append(part.get_content())
            except Exception:
                pass

    return "\n".join(lines)


def parse(file_path: Path) -> ParsedDocument:
    metadata = DocumentMetadata(
        filename=file_path.name,
        file_type=DocumentType.EMAIL,
        file_size_bytes=file_path.stat().st_size,
        source_path=str(file_path),
    )

    errors = []
    raw_text = ""

    try:
        raw_text = _eml_to_text(file_path)
    except Exception as e:
        errors.append(f"Email parse error: {e}")
        return ParsedDocument(metadata=metadata, status=ExtractionStatus.FAILED, errors=errors)

    if not raw_text.strip():
        errors.append("No text content found in email.")
        return ParsedDocument(metadata=metadata, status=ExtractionStatus.FAILED, raw_text=raw_text, errors=errors)

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
        return ParsedDocument(metadata=metadata, status=ExtractionStatus.PARTIAL, raw_text=raw_text, errors=errors)
