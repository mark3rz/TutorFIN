"""
parsers/email.py — Email (.eml) ingestion and extraction.
Uses Python's built-in email module, Claude for structured data.

Phase 1 improvements:
  - Extracts HTML body and converts to plain text (with html2text or fallback regex)
  - Extracts attachment metadata (names, sizes, content types)
  - Includes CC/BCC headers
"""

import email
import re
from email import policy
from pathlib import Path
from pipeline.schema import ParsedDocument, DocumentMetadata, DocumentType, ExtractionStatus, BusinessEntity
from pipeline import llm


def _strip_html(html: str) -> str:
    """
    Simple HTML to text conversion using regex.
    Used as a fallback when html2text is not installed.
    """
    # Remove style/script blocks
    text = re.sub(r"<(style|script)[^>]*>.*?</\1>", "", html, flags=re.DOTALL | re.IGNORECASE)
    # Replace common block elements with newlines
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</?(p|div|tr|li|h[1-6])[^>]*>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<td[^>]*>", "\t", text, flags=re.IGNORECASE)
    # Remove remaining tags
    text = re.sub(r"<[^>]+>", "", text)
    # Decode HTML entities
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"&lt;", "<", text)
    text = re.sub(r"&gt;", ">", text)
    text = re.sub(r"&quot;", '"', text)
    # Clean up whitespace
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _html_to_text(html: str) -> str:
    """Convert HTML to plain text, using html2text if available."""
    try:
        import html2text
        h = html2text.HTML2Text()
        h.ignore_links = False
        h.ignore_images = True
        h.body_width = 0  # no wrapping
        return h.handle(html)
    except ImportError:
        return _strip_html(html)


def _eml_to_text(file_path: Path) -> tuple[str, list[dict]]:
    """
    Extract text content and attachment metadata from an email.
    Returns (full_text, attachments_list).
    """
    with open(file_path, "rb") as f:
        msg = email.message_from_binary_file(f, policy=policy.default)

    lines = [
        f"From: {msg.get('From', '')}",
        f"To: {msg.get('To', '')}",
    ]
    # Include CC/BCC if present
    if msg.get("Cc"):
        lines.append(f"CC: {msg['Cc']}")
    if msg.get("Bcc"):
        lines.append(f"BCC: {msg['Bcc']}")

    lines.extend([
        f"Subject: {msg.get('Subject', '')}",
        f"Date: {msg.get('Date', '')}",
        "",
    ])

    plain_text_parts = []
    html_parts = []
    attachments = []

    # Walk through all MIME parts
    for part in msg.walk():
        content_type = part.get_content_type()
        content_disposition = str(part.get("Content-Disposition", ""))
        filename = part.get_filename()

        # Track attachments
        if filename or "attachment" in content_disposition.lower():
            attachment_info = {
                "filename": filename or "(unnamed)",
                "content_type": content_type,
                "size_bytes": len(part.get_payload(decode=True) or b""),
            }
            attachments.append(attachment_info)
            continue

        # Extract text content
        if content_type == "text/plain":
            try:
                plain_text_parts.append(part.get_content())
            except Exception:
                pass
        elif content_type == "text/html":
            try:
                html_content = part.get_content()
                html_parts.append(html_content)
            except Exception:
                pass

    # Prefer plain text; fall back to converted HTML
    if plain_text_parts:
        body_text = "\n".join(plain_text_parts)
    elif html_parts:
        body_text = "\n".join(_html_to_text(h) for h in html_parts)
    else:
        body_text = ""

    lines.append(body_text)

    # Append attachment summary if present
    if attachments:
        lines.append("\n=== Attachments ===")
        for att in attachments:
            size_kb = att["size_bytes"] / 1024
            lines.append(f"  - {att['filename']} ({att['content_type']}, {size_kb:.1f} KB)")

    return "\n".join(lines), attachments


def parse(file_path: Path) -> ParsedDocument:
    metadata = DocumentMetadata(
        filename=file_path.name,
        file_type=DocumentType.EMAIL,
        file_size_bytes=file_path.stat().st_size,
        source_path=str(file_path),
    )

    errors = []
    raw_text = ""
    attachments = []

    try:
        raw_text, attachments = _eml_to_text(file_path)
    except Exception as e:
        errors.append(f"Email parse error: {e}")
        return ParsedDocument(metadata=metadata, status=ExtractionStatus.FAILED, errors=errors)

    if not raw_text.strip():
        errors.append("No text content found in email.")
        return ParsedDocument(metadata=metadata, status=ExtractionStatus.FAILED, raw_text=raw_text, errors=errors)

    try:
        extracted = llm.extract(raw_text)
        entities = [BusinessEntity(**e) for e in extracted.get("entities", [])]

        # Add attachment info to data_fields if present
        data_fields = extracted.get("data_fields", {})
        if attachments:
            data_fields["attachment_count"] = str(len(attachments))
            data_fields["attachment_names"] = ", ".join(a["filename"] for a in attachments)

        return ParsedDocument(
            metadata=metadata,
            status=ExtractionStatus.SUCCESS,
            raw_text=raw_text,
            entities=entities,
            summary=extracted.get("summary", ""),
            data_fields=data_fields,
            errors=errors,
        )
    except Exception as e:
        errors.append(f"LLM extraction error: {e}")
        return ParsedDocument(metadata=metadata, status=ExtractionStatus.PARTIAL, raw_text=raw_text, errors=errors)
