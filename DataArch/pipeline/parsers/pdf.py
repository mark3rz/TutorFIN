"""
parsers/pdf.py — PDF ingestion and extraction.
Uses PyMuPDF for text extraction, Claude for structured data.
Falls back to OCR (pytesseract) for scanned / image-based PDFs.
"""

import fitz  # PyMuPDF
import io
from pathlib import Path
from pipeline.schema import ParsedDocument, DocumentMetadata, DocumentType, ExtractionStatus, BusinessEntity
from pipeline import llm

# Maximum pages to OCR (keeps latency reasonable for large scanned documents)
_OCR_PAGE_LIMIT = 50


def _try_ocr(file_path: Path, page_count: int) -> str:
    """Attempt OCR on a scanned PDF using pytesseract + PyMuPDF pixmaps.

    Returns extracted text, or an empty string if OCR is unavailable or fails.
    Gracefully degrades: if pytesseract / Pillow are not installed the function
    returns "" without raising — the caller will treat the document as FAILED.
    """
    try:
        import pytesseract
        from PIL import Image
    except ImportError:
        return ""

    ocr_pages: list[str] = []
    try:
        doc = fitz.open(str(file_path))
        for page_num, page in enumerate(doc):
            if page_num >= _OCR_PAGE_LIMIT:
                break
            # Render page to a 300-dpi bitmap then hand to Tesseract
            pix = page.get_pixmap(dpi=300)
            img = Image.open(io.BytesIO(pix.tobytes("png")))
            text = pytesseract.image_to_string(img)
            if text.strip():
                ocr_pages.append(text)
        doc.close()
    except Exception:
        return ""

    return "\n".join(ocr_pages)


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

    # ── OCR fallback for scanned / image-based PDFs ─────────────────────────
    if not raw_text.strip():
        ocr_text = _try_ocr(file_path, metadata.page_count or 0)
        if ocr_text.strip():
            raw_text = ocr_text
            errors.append(
                "No native text layer found — OCR was used to extract content. "
                "Accuracy may be lower than digital PDFs."
            )
        else:
            errors.append(
                "No extractable text found — document may be scanned/image-based. "
                "Install Tesseract (apt-get install tesseract-ocr) to enable OCR fallback."
            )
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
