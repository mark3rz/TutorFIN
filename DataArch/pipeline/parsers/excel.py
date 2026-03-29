"""
parsers/excel.py — Excel / CSV ingestion and extraction.

v0.9.0 upgrade: structure-aware extraction via excel_intelligence.py

Strategy:
  STRUCTURED sheets  (vendor_list, headcount_roster, etc.)
    → Converted to a proper JSON table via sheet_to_records()
    → Entities extracted row-by-row: one entity per data row
    → Much higher precision than flat-text extraction

  UNSTRUCTURED sheets  (no clear header, sparse data, OTHER classification)
    → Flattened to tab-delimited text (legacy behaviour)
    → Sent as a single blob to Claude for extraction

  CSV files
    → Legacy flat-text extraction (unchanged)

This means a workbook with mixed sheets (e.g. a "Vendors" structured sheet
and a "Notes" freeform sheet) gets the best strategy for each sheet.
"""

import csv
import json
import logging
from pathlib import Path
from typing import Any

import openpyxl

from pipeline.schema import (
    ParsedDocument, DocumentMetadata, DocumentType,
    ExtractionStatus, BusinessEntity,
)
from pipeline import llm
from pipeline.parsers.excel_intelligence import (
    analyse_workbook,
    sheet_to_records,
    SheetClass,
    WorkbookAnalysis,
    SheetAnalysis,
)

logger = logging.getLogger(__name__)

# ── Classification → LLM entity_type hint mapping ────────────────────────────
# When we extract entities row-by-row, we can suggest the likely entity type
# to Claude based on the sheet's classification, improving accuracy.

_CLASS_TO_ENTITY_HINT: dict[SheetClass, str] = {
    SheetClass.VENDOR_LIST:         "vendor",
    SheetClass.HEADCOUNT_ROSTER:    "employee",
    SheetClass.FINANCIAL_STATEMENT: "financial_record",
    SheetClass.REVENUE_MODEL:       "financial_record",
    SheetClass.CAP_TABLE:           "financial_record",
    SheetClass.BUDGET:              "financial_record",
    SheetClass.CONTRACT_SUMMARY:    "contract",
    SheetClass.TRANSACTION_LOG:     "transaction",
    SheetClass.OTHER:               "unknown",
}


# ── Structured sheet extraction ───────────────────────────────────────────────

def _extract_from_structured_sheet(
    sheet: SheetAnalysis,
    file_path: Path,
    entity_hint: str,
) -> list[BusinessEntity]:
    """
    Extract entities from a structured sheet row-by-row.

    Converts each data row to a JSON object, then sends it to Claude
    with a prompt that specifies the expected entity type.  This is
    far more accurate than passing raw tab-delimited text.
    """
    records = sheet_to_records(sheet, file_path)
    if not records:
        logger.warning(f"  Sheet '{sheet.name}': structured but produced no records")
        return []

    logger.info(
        f"  Sheet '{sheet.name}' ({sheet.classification.value}): "
        f"extracting {len(records)} rows as '{entity_hint}' entities"
    )

    # Build a compact JSON representation of all rows
    # Cap at 200 rows per sheet to avoid token limits; large sheets should be
    # paginated in a future iteration.
    MAX_ROWS_PER_SHEET = 200
    if len(records) > MAX_ROWS_PER_SHEET:
        logger.warning(
            f"  Sheet '{sheet.name}': {len(records)} rows exceeds limit "
            f"({MAX_ROWS_PER_SHEET}). Truncating."
        )
        records = records[:MAX_ROWS_PER_SHEET]

    # Build column context string (header → type) to help Claude
    col_context = ", ".join(
        f"{c.header} ({c.col_type.value})"
        for c in sheet.columns
        if c.header
    )

    structured_text = (
        f"Sheet: {sheet.name}\n"
        f"Classification: {sheet.classification.value}\n"
        f"Expected entity type: {entity_hint}\n"
        f"Columns: {col_context}\n\n"
        f"Data rows (JSON):\n"
        + json.dumps(records, default=str, indent=2)
    )

    try:
        extracted = llm.extract(structured_text)
        entities = [BusinessEntity(**e) for e in extracted.get("entities", [])]
        logger.info(f"  Sheet '{sheet.name}': extracted {len(entities)} entities")
        return entities
    except Exception as e:
        logger.error(f"  Sheet '{sheet.name}': LLM extraction failed: {e}")
        return []


# ── Unstructured sheet extraction (legacy fallback) ───────────────────────────

def _sheet_to_flat_text(sheet: SheetAnalysis, file_path: Path) -> str:
    """
    Convert an unstructured sheet to flat tab-delimited text.
    Used as fallback for sheets that don't pass the structured criteria.
    """
    wb = openpyxl.load_workbook(str(file_path), read_only=True, data_only=True)
    if sheet.name not in wb.sheetnames:
        wb.close()
        return ""
    ws = wb[sheet.name]
    lines = [f"=== Sheet: {sheet.name} ==="]
    for row in ws.iter_rows(values_only=True):
        row_text = "\t".join(str(c) if c is not None else "" for c in row)
        if row_text.strip():
            lines.append(row_text)
    wb.close()
    return "\n".join(lines)


def _extract_from_unstructured_sheet(
    sheet: SheetAnalysis,
    file_path: Path,
) -> list[BusinessEntity]:
    """
    Legacy flat-text extraction for unstructured sheets.
    """
    text = _sheet_to_flat_text(sheet, file_path)
    if not text.strip():
        return []

    logger.info(
        f"  Sheet '{sheet.name}': unstructured "
        f"(reason: {sheet.skip_reason or 'n/a'}), using flat-text extraction"
    )

    try:
        extracted = llm.extract(text)
        return [BusinessEntity(**e) for e in extracted.get("entities", [])]
    except Exception as e:
        logger.error(f"  Sheet '{sheet.name}': flat-text extraction failed: {e}")
        return []


# ── CSV parsing (unchanged) ───────────────────────────────────────────────────

def _csv_to_text(file_path: Path) -> str:
    """Read a CSV file and return tab-delimited text."""
    with open(file_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        return "\n".join("\t".join(row) for row in reader)


# ── Main parse entry point ────────────────────────────────────────────────────

def parse(file_path: Path) -> ParsedDocument:
    """
    Parse an Excel (.xlsx, .xlsm) or CSV file.

    For Excel files, runs excel_intelligence analysis first, then routes
    each sheet to the appropriate extraction strategy (structured or flat-text).
    For CSV files, uses the legacy flat-text path.

    Returns a ParsedDocument compatible with all downstream pipeline stages.
    """
    suffix = file_path.suffix.lower()

    metadata = DocumentMetadata(
        filename=file_path.name,
        file_type=DocumentType.EXCEL,
        file_size_bytes=file_path.stat().st_size,
        source_path=str(file_path),
    )

    errors: list[str] = []
    all_entities: list[BusinessEntity] = []
    all_summaries: list[str] = []
    all_data_fields: dict[str, Any] = {}
    raw_text_parts: list[str] = []

    # ── CSV: legacy path ──────────────────────────────────────────────────────
    if suffix == ".csv":
        try:
            raw_text = _csv_to_text(file_path)
            raw_text_parts.append(raw_text)
        except Exception as e:
            errors.append(f"CSV parse error: {e}")
            return ParsedDocument(
                metadata=metadata,
                status=ExtractionStatus.FAILED,
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

    # ── Excel: intelligence-guided path ──────────────────────────────────────
    if suffix not in (".xlsx", ".xlsm"):
        errors.append(f"Unsupported Excel format: {suffix}")
        return ParsedDocument(
            metadata=metadata,
            status=ExtractionStatus.FAILED,
            errors=errors,
        )

    try:
        analysis: WorkbookAnalysis = analyse_workbook(file_path)
        metadata.sheet_count = analysis.sheet_count
    except Exception as e:
        errors.append(f"Excel intelligence analysis failed: {e}. Falling back to legacy parsing.")
        logger.error(f"Excel intelligence failed for {file_path.name}: {e}")
        # Hard fallback: legacy flat-text extraction of entire workbook
        return _parse_legacy(file_path, metadata, errors)

    if not analysis.sheets:
        errors.append("Workbook contains no readable sheets.")
        return ParsedDocument(
            metadata=metadata,
            status=ExtractionStatus.FAILED,
            errors=errors,
        )

    # Process each sheet with the appropriate strategy
    for sheet in analysis.sheets:
        if sheet.total_rows == 0:
            logger.info(f"  Skipping empty sheet '{sheet.name}'")
            continue

        entity_hint = _CLASS_TO_ENTITY_HINT.get(sheet.classification, "unknown")

        if sheet.is_structured:
            entities = _extract_from_structured_sheet(sheet, file_path, entity_hint)
        else:
            entities = _extract_from_unstructured_sheet(sheet, file_path)
            # Also capture flat text for the raw_text field
            flat = _sheet_to_flat_text(sheet, file_path)
            if flat.strip():
                raw_text_parts.append(flat)

        all_entities.extend(entities)

    # Build combined raw_text from unstructured sheets
    raw_text = "\n\n".join(raw_text_parts)

    # Build a workbook-level summary
    structured_count = len(analysis.structured_sheets)
    unstructured_count = len(analysis.unstructured_sheets)
    summary = (
        f"Excel workbook '{file_path.name}' with {analysis.sheet_count} sheet(s). "
        f"{structured_count} sheet(s) processed with structure-aware extraction "
        f"({', '.join(s.name for s in analysis.structured_sheets) or 'none'}). "
        f"{unstructured_count} sheet(s) processed with flat-text extraction. "
        f"Total entities extracted: {len(all_entities)}."
    )

    status = ExtractionStatus.SUCCESS if all_entities else ExtractionStatus.PARTIAL
    if errors and not all_entities:
        status = ExtractionStatus.FAILED

    logger.info(
        f"[ExcelParser] {file_path.name}: {len(all_entities)} entities total "
        f"({structured_count} structured sheets, {unstructured_count} flat-text sheets)"
    )

    return ParsedDocument(
        metadata=metadata,
        status=status,
        raw_text=raw_text,
        entities=all_entities,
        summary=summary,
        data_fields=all_data_fields,
        errors=errors,
    )


# ── Legacy fallback (whole-workbook flat text) ────────────────────────────────

def _parse_legacy(
    file_path: Path,
    metadata: DocumentMetadata,
    errors: list[str],
) -> ParsedDocument:
    """
    Original v0.8.x parser: read all sheets as flat text and send to Claude.
    Used only when the intelligence layer fails entirely.
    """
    try:
        wb = openpyxl.load_workbook(str(file_path), read_only=True, data_only=True)
        lines: list[str] = []
        for sheet_name in wb.sheetnames:
            ws = wb[sheet_name]
            lines.append(f"=== Sheet: {sheet_name} ===")
            for row in ws.iter_rows(values_only=True):
                row_text = "\t".join(str(c) if c is not None else "" for c in row)
                if row_text.strip():
                    lines.append(row_text)
        wb.close()
        raw_text = "\n".join(lines)
        metadata.sheet_count = len(wb.sheetnames)
    except Exception as e:
        errors.append(f"Legacy Excel parse error: {e}")
        return ParsedDocument(
            metadata=metadata,
            status=ExtractionStatus.FAILED,
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
        errors.append(f"LLM extraction error (legacy): {e}")
        return ParsedDocument(
            metadata=metadata,
            status=ExtractionStatus.PARTIAL,
            raw_text=raw_text,
            errors=errors,
        )
