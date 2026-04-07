"""
pipeline/parsers/excel_intelligence.py — Smart pre-processing layer for Excel files.

Runs BEFORE the LLM extraction step. Analyses workbook structure so that
downstream extraction can work with proper tables rather than flat text blobs.

Capabilities (v0.9.0):
  - Sheet-level classification  (vendor_list, headcount_roster, financial_statement, …)
  - Header row detection        (finds the real header, not always row 1)
  - Data type inference         (reads openpyxl number-format codes, not just cell values)
  - Merged cell resolution      (unmerge + fill down/right)
  - Empty row/column stripping  (removes logo rows, whitespace, disclaimer footers)

Public API:
  analyse_workbook(file_path) -> WorkbookAnalysis
      Returns a complete structural analysis. Does NOT call the LLM.

  sheet_to_records(ws_analysis, wb) -> list[dict]
      Converts a classified sheet into a list of row-dicts ready for entity extraction.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any

import openpyxl
from openpyxl.utils import get_column_letter

logger = logging.getLogger(__name__)


# ── Sheet classification labels ──────────────────────────────────────────────

class SheetClass(str, Enum):
    VENDOR_LIST         = "vendor_list"
    HEADCOUNT_ROSTER    = "headcount_roster"
    FINANCIAL_STATEMENT = "financial_statement"
    REVENUE_MODEL       = "revenue_model"
    CAP_TABLE           = "cap_table"
    BUDGET              = "budget"
    CONTRACT_SUMMARY    = "contract_summary"
    TRANSACTION_LOG     = "transaction_log"
    OTHER               = "other"


# ── Column data type labels ───────────────────────────────────────────────────

class ColumnType(str, Enum):
    CURRENCY    = "currency"
    PERCENTAGE  = "percentage"
    DATE        = "date"
    INTEGER     = "integer"
    DECIMAL     = "decimal"
    TEXT        = "text"
    FORMULA     = "formula"     # cell had a formula (data_only=False pass)
    EMPTY       = "empty"


# ── Data models ───────────────────────────────────────────────────────────────

@dataclass
class ColumnMeta:
    """Metadata about a single column in a sheet."""
    index: int              # 0-based column index
    letter: str             # Excel column letter e.g. "A", "B", "AC"
    header: str             # detected header text (may be empty string)
    col_type: ColumnType    # inferred data type
    non_empty_rows: int     # count of rows with data (excluding header)
    sample_values: list[Any] = field(default_factory=list)  # up to 5 sample values


@dataclass
class SheetAnalysis:
    """Full structural analysis of a single worksheet."""
    name: str
    classification: SheetClass
    header_row_index: int           # 0-based row index of the header row (-1 = not found)
    total_rows: int                 # including header and data rows
    data_rows: int                  # rows below header with at least one value
    total_cols: int
    columns: list[ColumnMeta]
    has_merged_cells: bool
    is_structured: bool             # True = suitable for row-by-row entity extraction
    skip_reason: str = ""           # populated when sheet should be skipped
    formula_columns: list[str] = field(default_factory=list)   # column letters with formulas


@dataclass
class WorkbookAnalysis:
    """Full analysis of an Excel workbook."""
    filename: str
    sheet_count: int
    sheets: list[SheetAnalysis]

    @property
    def structured_sheets(self) -> list[SheetAnalysis]:
        """Sheets that are suitable for row-by-row entity extraction."""
        return [s for s in self.sheets if s.is_structured]

    @property
    def unstructured_sheets(self) -> list[SheetAnalysis]:
        """Sheets that must fall back to flat-text + LLM extraction."""
        return [s for s in self.sheets if not s.is_structured]


# ── Number format → ColumnType mapping ───────────────────────────────────────
#
# openpyxl stores the raw Excel number format string on each cell via
# cell.number_format.  These strings are not standardised but follow
# well-known patterns across most Excel files produced by US/UK finance.

_CURRENCY_PATTERNS = re.compile(
    r'(\$|£|€|¥|USD|GBP|EUR|"$"|"\$")',
    re.IGNORECASE,
)
_PERCENTAGE_PATTERN = re.compile(r'%')
_DATE_PATTERNS = re.compile(
    r'\b(yy|yyyy|mm|mmm|mmmm|dd|d)\b',
    re.IGNORECASE,
)


def _infer_column_type_from_format(number_format: str) -> ColumnType | None:
    """
    Attempt to infer a ColumnType from an openpyxl number_format string.
    Returns None if the format string is uninformative (e.g. "General").
    """
    if not number_format or number_format in ("General", "@", ""):
        return None
    if _CURRENCY_PATTERNS.search(number_format):
        return ColumnType.CURRENCY
    if _PERCENTAGE_PATTERN.search(number_format):
        return ColumnType.PERCENTAGE
    if _DATE_PATTERNS.search(number_format):
        return ColumnType.DATE
    if number_format in ("0", "#,##0", "0.00", "#,##0.00"):
        return ColumnType.DECIMAL
    return None


def _infer_column_type_from_values(values: list[Any]) -> ColumnType:
    """
    Fallback type inference from actual cell values when number format
    strings are uninformative.
    """
    non_null = [v for v in values if v is not None and v != ""]
    if not non_null:
        return ColumnType.EMPTY

    from datetime import date, datetime
    date_count = sum(1 for v in non_null if isinstance(v, (date, datetime)))
    if date_count / len(non_null) > 0.6:
        return ColumnType.DATE

    numeric = [v for v in non_null if isinstance(v, (int, float))]
    if len(numeric) / len(non_null) > 0.6:
        # Check if values look like percentages (all between 0-1 or 0-100)
        if all(0 <= v <= 1 for v in numeric):
            return ColumnType.PERCENTAGE
        if all(v == int(v) for v in numeric):
            return ColumnType.INTEGER
        return ColumnType.DECIMAL

    return ColumnType.TEXT


# ── Sheet classification ──────────────────────────────────────────────────────

# Keywords mapped to sheet classifications.
# Matched against the lowercase sheet name and the lowercase header row text.
_CLASSIFICATION_RULES: list[tuple[SheetClass, list[str]]] = [
    (SheetClass.VENDOR_LIST,         ["vendor", "supplier", "payable", "ap ", "accounts payable"]),
    (SheetClass.HEADCOUNT_ROSTER,    ["headcount", "employee", "staff", "roster", "personnel",
                                      "org chart", "hr ", "payroll", "compensation"]),
    (SheetClass.FINANCIAL_STATEMENT, ["p&l", "profit", "income statement", "balance sheet",
                                      "trial balance", "general ledger", "gl ", "ebitda",
                                      "revenue", "expense", "cogs", "gross margin"]),
    (SheetClass.REVENUE_MODEL,       ["revenue model", "arr", "mrr", "forecast", "projection",
                                      "pipeline", "bookings", "churn"]),
    (SheetClass.CAP_TABLE,           ["cap table", "capitalization", "equity", "shares",
                                      "option pool", "dilution", "shareholder"]),
    (SheetClass.BUDGET,              ["budget", "opex", "capex", "spend plan", "cost center"]),
    (SheetClass.CONTRACT_SUMMARY,    ["contract", "agreement", "renewal", "expir", "sla",
                                      "master service", "statement of work", "sow"]),
    (SheetClass.TRANSACTION_LOG,     ["transaction", "invoice", "receipt", "payment",
                                      "purchase order", "po ", "ledger entry"]),
]


def _classify_sheet(sheet_name: str, header_texts: list[str]) -> SheetClass:
    """
    Classify a worksheet based on its name and the text in its header row.
    Returns SheetClass.OTHER if no rule matches.
    """
    combined = (sheet_name + " " + " ".join(header_texts)).lower()
    for classification, keywords in _CLASSIFICATION_RULES:
        if any(kw in combined for kw in keywords):
            return classification
    return SheetClass.OTHER


# ── Header row detection ──────────────────────────────────────────────────────

def _find_header_row(rows: list[list[Any]], max_scan: int = 20) -> int:
    """
    Scan the first `max_scan` rows to find the actual header row.

    Heuristic: the header row is the first row (within the scan window) where:
      1. More than 50% of cells are non-empty strings
      2. No cell value looks like a pure number or date (headers are labels)

    Returns 0-based index of the header row, or -1 if not found.
    """
    from datetime import date, datetime

    scan = rows[:max_scan]
    for i, row in enumerate(scan):
        non_empty = [c for c in row if c is not None and str(c).strip() != ""]
        if not non_empty:
            continue
        if len(non_empty) < max(2, len(row) * 0.3):
            continue

        string_cells = [c for c in non_empty if isinstance(c, str)]
        numeric_cells = [c for c in non_empty if isinstance(c, (int, float))]
        date_cells = [c for c in non_empty if isinstance(c, (date, datetime))]

        # A header row should be mostly strings, not numbers or dates
        string_ratio = len(string_cells) / len(non_empty)
        if string_ratio >= 0.5 and len(numeric_cells) + len(date_cells) < len(non_empty) * 0.5:
            return i

    return -1


# ── Merged cell resolution ────────────────────────────────────────────────────

def _resolve_merged_cells(ws) -> list[list[Any]]:
    """
    Return a 2D list of cell values with merged ranges filled in.

    openpyxl leaves merged cells (other than the top-left anchor) as None.
    This function fills those cells with the value of the top-left anchor,
    simulating what a user sees in Excel.

    We load with data_only=True so formulas show their computed results.
    """
    # Build a dict: (row, col) -> fill_value from merged ranges
    fill: dict[tuple[int, int], Any] = {}
    for rng in ws.merged_cells.ranges:
        anchor_value = ws.cell(rng.min_row, rng.min_col).value
        for r in range(rng.min_row, rng.max_row + 1):
            for c in range(rng.min_col, rng.max_col + 1):
                if r == rng.min_row and c == rng.min_col:
                    continue  # anchor cell already has the value
                fill[(r, c)] = anchor_value

    # Build the full 2D grid
    rows: list[list[Any]] = []
    for r_idx, row in enumerate(ws.iter_rows(values_only=False), start=1):
        row_vals: list[Any] = []
        for c_idx, cell in enumerate(row, start=1):
            if (r_idx, c_idx) in fill:
                row_vals.append(fill[(r_idx, c_idx)])
            else:
                row_vals.append(cell.value)
        rows.append(row_vals)

    return rows


def _strip_empty_rows_and_cols(
    rows: list[list[Any]],
    empty_threshold: float = 0.8,
) -> list[list[Any]]:
    """
    Remove rows and columns that are more than `empty_threshold` fraction empty.
    This eliminates logo rows, spacer rows, disclaimer footer rows.
    """
    if not rows:
        return rows

    def _is_empty(val: Any) -> bool:
        return val is None or str(val).strip() == ""

    # Filter rows
    filtered_rows = [
        row for row in rows
        if sum(1 for c in row if _is_empty(c)) / max(len(row), 1) < empty_threshold
    ]

    if not filtered_rows:
        return filtered_rows

    # Filter columns (transpose, filter, transpose back)
    col_count = max(len(r) for r in filtered_rows)
    # Pad rows to uniform width
    padded = [r + [None] * (col_count - len(r)) for r in filtered_rows]

    keep_cols = []
    for c in range(col_count):
        col_vals = [padded[r][c] for r in range(len(padded))]
        empty_ratio = sum(1 for v in col_vals if _is_empty(v)) / len(col_vals)
        if empty_ratio < empty_threshold:
            keep_cols.append(c)

    result = [[row[c] for c in keep_cols] for row in padded]
    return result


# ── Column metadata extraction ────────────────────────────────────────────────

def _extract_column_metadata(
    ws,
    rows: list[list[Any]],
    header_row_index: int,
) -> list[ColumnMeta]:
    """
    Build ColumnMeta for each column, using openpyxl number formats
    (from the first data row of each column) for type inference.
    """
    if header_row_index < 0 or not rows:
        return []

    header_row = rows[header_row_index]
    data_rows = rows[header_row_index + 1:]

    # Build a quick lookup: col_index -> number_format string
    # We read formats from the actual worksheet (not from our processed rows list)
    # by sampling the first non-empty data cell per column.
    format_lookup: dict[int, str] = {}
    for row in ws.iter_rows():
        for cell in row:
            col_idx = cell.column - 1  # 0-based
            if col_idx not in format_lookup and cell.number_format:
                format_lookup[col_idx] = cell.number_format
            # Stop once we've seen a format for every column
            if len(format_lookup) >= len(header_row):
                break

    columns: list[ColumnMeta] = []
    for c_idx, header_val in enumerate(header_row):
        header_str = str(header_val).strip() if header_val is not None else ""
        letter = get_column_letter(c_idx + 1)

        # Collect data values for this column
        col_values = []
        for row in data_rows:
            val = row[c_idx] if c_idx < len(row) else None
            col_values.append(val)

        non_empty_count = sum(1 for v in col_values if v is not None and str(v).strip() != "")
        samples = [v for v in col_values if v is not None and str(v).strip() != ""][:5]

        # Type inference: number format first, then value-based fallback
        fmt = format_lookup.get(c_idx, "")
        col_type = _infer_column_type_from_format(fmt)
        if col_type is None:
            col_type = _infer_column_type_from_values(col_values)

        columns.append(ColumnMeta(
            index=c_idx,
            letter=letter,
            header=header_str,
            col_type=col_type,
            non_empty_rows=non_empty_count,
            sample_values=samples,
        ))

    return columns


# ── Formula detection (second-pass without data_only) ────────────────────────

def _detect_formula_columns(file_path: Path, sheet_name: str) -> list[str]:
    """
    Open the workbook WITHOUT data_only to detect formula cells.
    Returns a list of column letters that contain formulas.
    """
    try:
        wb_formulas = openpyxl.load_workbook(str(file_path), data_only=False, read_only=True)
        if sheet_name not in wb_formulas.sheetnames:
            wb_formulas.close()
            return []
        ws = wb_formulas[sheet_name]
        formula_cols: set[str] = set()
        for row in ws.iter_rows():
            for cell in row:
                if cell.value and isinstance(cell.value, str) and cell.value.startswith("="):
                    formula_cols.add(get_column_letter(cell.column))
        wb_formulas.close()
        return sorted(formula_cols)
    except Exception as e:
        logger.warning(f"Formula detection failed for sheet '{sheet_name}': {e}")
        return []


# ── Structured-sheet decision ─────────────────────────────────────────────────

_MIN_DATA_ROWS = 2          # must have at least 2 data rows to be "structured"
_MIN_HEADER_COLS = 2        # must have at least 2 non-empty header columns
_MIN_FILL_RATIO = 0.3       # at least 30% of cells in data rows must be non-empty


def _is_structured(
    rows: list[list[Any]],
    header_row_index: int,
    columns: list[ColumnMeta],
) -> tuple[bool, str]:
    """
    Decide whether a sheet is suitable for row-by-row entity extraction.

    Returns (True, "") if structured, or (False, reason) if not.
    """
    if header_row_index < 0:
        return False, "No header row detected"

    data_rows = rows[header_row_index + 1:]
    if len(data_rows) < _MIN_DATA_ROWS:
        return False, f"Too few data rows ({len(data_rows)} < {_MIN_DATA_ROWS})"

    named_cols = [c for c in columns if c.header]
    if len(named_cols) < _MIN_HEADER_COLS:
        return False, f"Too few named columns ({len(named_cols)} < {_MIN_HEADER_COLS})"

    # Check overall cell fill ratio in data rows
    total_cells = sum(len(r) for r in data_rows)
    if total_cells == 0:
        return False, "No data cells"

    filled = sum(
        1 for r in data_rows for v in r
        if v is not None and str(v).strip() != ""
    )
    fill_ratio = filled / total_cells
    if fill_ratio < _MIN_FILL_RATIO:
        return False, f"Low cell fill ratio ({fill_ratio:.0%} < {_MIN_FILL_RATIO:.0%})"

    return True, ""


# ── Main public API ───────────────────────────────────────────────────────────

def analyse_workbook(file_path: Path) -> WorkbookAnalysis:
    """
    Perform full structural analysis of an Excel workbook.

    Loads the workbook twice:
      1. data_only=True  — for cell values and number formats
      2. data_only=False — for formula detection (sheet names only, lightweight)

    Does NOT call the LLM. Returns a WorkbookAnalysis ready for use by
    the upgraded excel.py parser.

    Args:
        file_path: Path to the .xlsx or .xlsm file.

    Returns:
        WorkbookAnalysis dataclass.
    """
    file_path = Path(file_path)
    logger.info(f"[ExcelIntelligence] Analysing: {file_path.name}")

    wb = openpyxl.load_workbook(str(file_path), data_only=True)
    sheet_analyses: list[SheetAnalysis] = []

    for sheet_name in wb.sheetnames:
        try:
            ws = wb[sheet_name]
            logger.debug(f"  Processing sheet: '{sheet_name}'")

            # 1. Resolve merged cells → clean 2D list
            has_merged = len(ws.merged_cells.ranges) > 0
            rows = _resolve_merged_cells(ws)

            # 2. Strip empty rows and columns
            rows = _strip_empty_rows_and_cols(rows)

            if not rows:
                sheet_analyses.append(SheetAnalysis(
                    name=sheet_name,
                    classification=SheetClass.OTHER,
                    header_row_index=-1,
                    total_rows=0,
                    data_rows=0,
                    total_cols=0,
                    columns=[],
                    has_merged_cells=has_merged,
                    is_structured=False,
                    skip_reason="Sheet is empty after stripping",
                ))
                continue

            # 3. Detect header row
            header_row_index = _find_header_row(rows)

            # 4. Extract column metadata
            columns = _extract_column_metadata(ws, rows, header_row_index)

            # 5. Detect formula columns (second pass, lightweight)
            formula_cols = _detect_formula_columns(file_path, sheet_name)

            # 6. Classify the sheet
            header_texts = [c.header for c in columns] if columns else []
            classification = _classify_sheet(sheet_name, header_texts)

            # 7. Determine if suitable for structured extraction
            data_row_count = max(0, len(rows) - header_row_index - 1) if header_row_index >= 0 else 0
            structured, skip_reason = _is_structured(rows, header_row_index, columns)

            sheet_analyses.append(SheetAnalysis(
                name=sheet_name,
                classification=classification,
                header_row_index=header_row_index,
                total_rows=len(rows),
                data_rows=data_row_count,
                total_cols=len(columns) if columns else (len(rows[0]) if rows else 0),
                columns=columns,
                has_merged_cells=has_merged,
                is_structured=structured,
                skip_reason=skip_reason,
                formula_columns=formula_cols,
            ))

            logger.info(
                f"  Sheet '{sheet_name}': {classification.value}, "
                f"header_row={header_row_index}, data_rows={data_row_count}, "
                f"structured={structured}"
                + (f", skip_reason='{skip_reason}'" if not structured else "")
            )

        except Exception as e:
            logger.error(f"  Failed to analyse sheet '{sheet_name}': {e}")
            sheet_analyses.append(SheetAnalysis(
                name=sheet_name,
                classification=SheetClass.OTHER,
                header_row_index=-1,
                total_rows=0,
                data_rows=0,
                total_cols=0,
                columns=[],
                has_merged_cells=False,
                is_structured=False,
                skip_reason=f"Analysis error: {e}",
            ))

    wb.close()

    analysis = WorkbookAnalysis(
        filename=file_path.name,
        sheet_count=len(wb.sheetnames),
        sheets=sheet_analyses,
    )

    structured_count = len(analysis.structured_sheets)
    logger.info(
        f"[ExcelIntelligence] Done: {len(sheet_analyses)} sheets, "
        f"{structured_count} structured, {len(sheet_analyses) - structured_count} unstructured"
    )
    return analysis


def sheet_to_records(sheet: SheetAnalysis, file_path: Path) -> list[dict[str, Any]]:
    """
    Convert a structured worksheet into a list of row-dicts.

    Each dict maps column header → cell value, matching the column
    metadata produced by analyse_workbook().  Summary rows (Total,
    Subtotal, Grand Total) are excluded.

    Args:
        sheet:      SheetAnalysis from analyse_workbook().
        file_path:  Path to the original .xlsx file (re-opened read-only).

    Returns:
        List of row dicts, one per data row, with header keys.
        Empty list if the sheet is not structured.
    """
    if not sheet.is_structured or sheet.header_row_index < 0:
        return []

    wb = openpyxl.load_workbook(str(file_path), data_only=True, read_only=True)
    if sheet.name not in wb.sheetnames:
        wb.close()
        return []

    ws = wb[sheet.name]
    rows = _resolve_merged_cells(ws)
    rows = _strip_empty_rows_and_cols(rows)
    wb.close()

    headers = [c.header for c in sheet.columns]
    data_rows = rows[sheet.header_row_index + 1:]

    # Build summary-row detector: rows where >50% of string cells contain
    # aggregation keywords are likely totals/subtotals and should be skipped.
    _SUMMARY_KEYWORDS = re.compile(
        r'\b(total|subtotal|grand total|sum|net|average|avg)\b',
        re.IGNORECASE,
    )

    records: list[dict[str, Any]] = []
    for row in data_rows:
        # Skip rows that appear to be summary/total rows
        string_vals = [str(v) for v in row if v is not None and isinstance(v, str)]
        if string_vals:
            summary_hits = sum(1 for s in string_vals if _SUMMARY_KEYWORDS.search(s))
            if summary_hits / len(string_vals) > 0.5:
                continue

        # Build the record dict — only include columns that have headers
        record: dict[str, Any] = {}
        for col in sheet.columns:
            val = row[col.index] if col.index < len(row) else None
            if col.header:
                # Serialise dates/datetimes to ISO strings
                if hasattr(val, "isoformat"):
                    val = val.isoformat()
                record[col.header] = val

        # Skip completely empty records
        if any(v is not None and str(v).strip() != "" for v in record.values()):
            records.append(record)

    return records


def workbook_analysis_to_dict(analysis: WorkbookAnalysis) -> dict:
    """
    Serialise a WorkbookAnalysis to a JSON-safe dict for the API response.
    """
    def _col(c: ColumnMeta) -> dict:
        return {
            "index": c.index,
            "letter": c.letter,
            "header": c.header,
            "col_type": c.col_type.value,
            "non_empty_rows": c.non_empty_rows,
            "sample_values": [
                v.isoformat() if hasattr(v, "isoformat") else v
                for v in c.sample_values
            ],
        }

    def _sheet(s: SheetAnalysis) -> dict:
        return {
            "name": s.name,
            "classification": s.classification.value,
            "header_row_index": s.header_row_index,
            "total_rows": s.total_rows,
            "data_rows": s.data_rows,
            "total_cols": s.total_cols,
            "columns": [_col(c) for c in s.columns],
            "has_merged_cells": s.has_merged_cells,
            "is_structured": s.is_structured,
            "skip_reason": s.skip_reason,
            "formula_columns": s.formula_columns,
        }

    return {
        "filename": analysis.filename,
        "sheet_count": analysis.sheet_count,
        "structured_sheet_count": len(analysis.structured_sheets),
        "sheets": [_sheet(s) for s in analysis.sheets],
    }
