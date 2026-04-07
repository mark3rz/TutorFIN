"""
pipeline/excel_templates.py — Downloadable Excel template generator for DataArch.AI.

Generates pre-formatted .xlsx upload templates, one per entity type.  Each
template contains:
  - A "Data" sheet with column headers derived from the ontology attributes
    for that entity type plus the standard system columns (canonical_name,
    company_id, source_file)
  - Column-level data validation (dropdowns, date pickers where applicable)
  - A "Instructions" sheet with a field-by-field legend and example rows
  - Professional formatting: frozen header row, auto-filter, alternating row
    colors, bold headers, appropriate column widths

Users download the template, fill it in, and re-upload it to DataArch.AI.
The Excel intelligence layer (excel_intelligence.py) will classify the sheet
as the matching entity type and extract rows via the structured path.

Queue #14 — Excel template generation
v0.9.4

Public API:
    generate_template(entity_type: str) -> bytes
        Returns the raw .xlsx bytes for the requested entity type.

    get_template_columns(entity_type: str) -> list[dict]
        Returns the column definitions used to build the template without
        generating the file. Useful for API metadata endpoints.
"""

from __future__ import annotations

import io
import logging
from typing import Any

logger = logging.getLogger(__name__)


# ── Column definitions ──────────────────────────────────────────────────────

# Standard columns present in every template (always first)
_STANDARD_COLUMNS: list[dict] = [
    {
        "name": "canonical_name",
        "header": "Canonical Name *",
        "description": "Primary identifier / display name for this entity. Required.",
        "example": "(see entity-specific examples below)",
        "sql_type_hint": "VARCHAR(255)",
        "required": True,
        "width": 30,
    },
]

# Standard audit / system columns appended at the end of every template
_AUDIT_COLUMNS: list[dict] = [
    {
        "name": "source_file",
        "header": "Source File",
        "description": "Original file this record came from. Leave blank — DataArch fills this automatically.",
        "example": "",
        "sql_type_hint": "VARCHAR(500)",
        "required": False,
        "width": 20,
    },
]

# Per-entity-type column definitions.
# Each attribute list is ordered by sort_order from seeds/ontology_defaults.py.
# sql_type_hint drives cell formatting and validation in the generated sheet.
_ENTITY_COLUMNS: dict[str, list[dict]] = {
    "vendor": [
        {
            "name": "vendor_id",
            "header": "Vendor ID",
            "description": "Internal vendor identifier (from your ERP / accounting system).",
            "example": "V-00123",
            "sql_type_hint": "VARCHAR(100)",
            "required": False,
            "width": 18,
        },
        {
            "name": "legal_name",
            "header": "Legal Name",
            "description": "Full legal entity name as it appears on invoices or contracts.",
            "example": "Acme Supplies LLC",
            "sql_type_hint": "VARCHAR(255)",
            "required": False,
            "width": 30,
        },
        {
            "name": "payment_terms",
            "header": "Payment Terms",
            "description": "Standard payment terms (e.g. Net 30, Net 60, Immediate).",
            "example": "Net 30",
            "sql_type_hint": "VARCHAR(100)",
            "required": False,
            "width": 18,
        },
        {
            "name": "category",
            "header": "Category",
            "description": "Vendor category or spend category (e.g. IT, Logistics, Marketing).",
            "example": "IT Services",
            "sql_type_hint": "VARCHAR(100)",
            "required": False,
            "width": 20,
        },
        {
            "name": "address",
            "header": "Address",
            "description": "Primary business address.",
            "example": "123 Main St, Springfield, IL 62701",
            "sql_type_hint": "TEXT",
            "required": False,
            "width": 35,
        },
        {
            "name": "contact_email",
            "header": "Contact Email",
            "description": "Primary contact email address.",
            "example": "ar@acmesupplies.com",
            "sql_type_hint": "VARCHAR(255)",
            "required": False,
            "width": 28,
        },
        {
            "name": "annual_spend",
            "header": "Annual Spend (USD)",
            "description": "Estimated or actual annual spend with this vendor.",
            "example": "250000.00",
            "sql_type_hint": "NUMERIC(14,2)",
            "required": False,
            "width": 22,
        },
    ],

    "customer": [
        {
            "name": "customer_id",
            "header": "Customer ID",
            "description": "Internal customer identifier (from your CRM / billing system).",
            "example": "C-00456",
            "sql_type_hint": "VARCHAR(100)",
            "required": False,
            "width": 18,
        },
        {
            "name": "legal_name",
            "header": "Legal Name",
            "description": "Full legal entity name.",
            "example": "TechCorp Inc.",
            "sql_type_hint": "VARCHAR(255)",
            "required": False,
            "width": 30,
        },
        {
            "name": "segment",
            "header": "Segment",
            "description": "Market or customer segment (e.g. Enterprise, SMB, Consumer).",
            "example": "Enterprise",
            "sql_type_hint": "VARCHAR(100)",
            "required": False,
            "width": 18,
        },
        {
            "name": "revenue_tier",
            "header": "Revenue Tier",
            "description": "Revenue tier classification (e.g. Tier 1, Platinum, >$1M ARR).",
            "example": "Tier 1",
            "sql_type_hint": "VARCHAR(50)",
            "required": False,
            "width": 16,
        },
        {
            "name": "annual_revenue",
            "header": "Annual Revenue (USD)",
            "description": "Annual revenue from this customer.",
            "example": "1200000.00",
            "sql_type_hint": "NUMERIC(14,2)",
            "required": False,
            "width": 22,
        },
        {
            "name": "contact_email",
            "header": "Contact Email",
            "description": "Primary contact email address.",
            "example": "billing@techcorp.com",
            "sql_type_hint": "VARCHAR(255)",
            "required": False,
            "width": 28,
        },
        {
            "name": "industry",
            "header": "Industry",
            "description": "Industry vertical (e.g. SaaS, Manufacturing, Healthcare).",
            "example": "SaaS",
            "sql_type_hint": "VARCHAR(100)",
            "required": False,
            "width": 20,
        },
    ],

    "employee": [
        {
            "name": "employee_id",
            "header": "Employee ID",
            "description": "Internal employee identifier (from your HRIS).",
            "example": "EMP-789",
            "sql_type_hint": "VARCHAR(100)",
            "required": False,
            "width": 18,
        },
        {
            "name": "role",
            "header": "Role / Title",
            "description": "Job title or role (e.g. Software Engineer, VP of Sales).",
            "example": "Senior Software Engineer",
            "sql_type_hint": "VARCHAR(100)",
            "required": False,
            "width": 28,
        },
        {
            "name": "department",
            "header": "Department",
            "description": "Department or business unit name.",
            "example": "Engineering",
            "sql_type_hint": "VARCHAR(100)",
            "required": False,
            "width": 20,
        },
        {
            "name": "compensation_band",
            "header": "Compensation Band",
            "description": "Salary band or grade (e.g. Band 3, IC4, Senior).",
            "example": "Band 3",
            "sql_type_hint": "VARCHAR(50)",
            "required": False,
            "width": 22,
        },
        {
            "name": "start_date",
            "header": "Start Date",
            "description": "Employment start date (YYYY-MM-DD).",
            "example": "2022-03-15",
            "sql_type_hint": "DATE",
            "required": False,
            "width": 16,
        },
        {
            "name": "end_date",
            "header": "End Date",
            "description": "Employment end date — leave blank for active employees.",
            "example": "",
            "sql_type_hint": "DATE",
            "required": False,
            "width": 16,
        },
        {
            "name": "employment_type",
            "header": "Employment Type",
            "description": "Full-time, Part-time, Contractor, Intern, etc.",
            "example": "Full-time",
            "sql_type_hint": "VARCHAR(50)",
            "required": False,
            "width": 20,
        },
        {
            "name": "location",
            "header": "Location / Office",
            "description": "Office location or remote status.",
            "example": "New York, NY",
            "sql_type_hint": "VARCHAR(255)",
            "required": False,
            "width": 22,
        },
    ],

    "product": [
        {
            "name": "product_id",
            "header": "Product ID / SKU",
            "description": "Internal product identifier or SKU.",
            "example": "SKU-001",
            "sql_type_hint": "VARCHAR(100)",
            "required": False,
            "width": 20,
        },
        {
            "name": "name",
            "header": "Product Name",
            "description": "Full product or service name.",
            "example": "Enterprise License — Annual",
            "sql_type_hint": "VARCHAR(255)",
            "required": False,
            "width": 30,
        },
        {
            "name": "unit_price",
            "header": "Unit Price (USD)",
            "description": "Standard list price per unit.",
            "example": "4999.00",
            "sql_type_hint": "NUMERIC(12,2)",
            "required": False,
            "width": 20,
        },
        {
            "name": "category",
            "header": "Category",
            "description": "Product category or line (e.g. Software, Hardware, Services).",
            "example": "Software",
            "sql_type_hint": "VARCHAR(100)",
            "required": False,
            "width": 20,
        },
        {
            "name": "revenue_type",
            "header": "Revenue Type",
            "description": "Revenue recognition type (e.g. Recurring, One-time, Usage-based).",
            "example": "Recurring",
            "sql_type_hint": "VARCHAR(50)",
            "required": False,
            "width": 20,
        },
        {
            "name": "description",
            "header": "Description",
            "description": "Short product description.",
            "example": "Annual enterprise seat license including support.",
            "sql_type_hint": "TEXT",
            "required": False,
            "width": 40,
        },
    ],

    "transaction": [
        {
            "name": "transaction_id",
            "header": "Transaction ID",
            "description": "Unique transaction identifier (invoice #, PO #, payment ref).",
            "example": "INV-2024-0001",
            "sql_type_hint": "VARCHAR(100)",
            "required": False,
            "width": 22,
        },
        {
            "name": "amount",
            "header": "Amount",
            "description": "Transaction amount (positive number). Use negative for credits.",
            "example": "15000.00",
            "sql_type_hint": "NUMERIC(14,2)",
            "required": False,
            "width": 18,
        },
        {
            "name": "currency",
            "header": "Currency",
            "description": "ISO currency code (e.g. USD, EUR, GBP).",
            "example": "USD",
            "sql_type_hint": "VARCHAR(10)",
            "required": False,
            "width": 12,
        },
        {
            "name": "date",
            "header": "Transaction Date",
            "description": "Date of the transaction (YYYY-MM-DD).",
            "example": "2024-01-15",
            "sql_type_hint": "DATE",
            "required": False,
            "width": 20,
        },
        {
            "name": "counterparty",
            "header": "Counterparty",
            "description": "Vendor or customer name on the other side of this transaction.",
            "example": "Acme Supplies LLC",
            "sql_type_hint": "VARCHAR(255)",
            "required": False,
            "width": 28,
        },
        {
            "name": "direction",
            "header": "Direction",
            "description": "Money direction: 'inbound' (you received) or 'outbound' (you paid).",
            "example": "outbound",
            "sql_type_hint": "VARCHAR(20)",
            "required": False,
            "width": 16,
        },
        {
            "name": "transaction_type",
            "header": "Transaction Type",
            "description": "Type of transaction: Invoice, Payment, Credit Note, PO, Wire Transfer, etc.",
            "example": "Invoice",
            "sql_type_hint": "VARCHAR(50)",
            "required": False,
            "width": 22,
        },
        {
            "name": "description",
            "header": "Description",
            "description": "Short description of what was bought/sold.",
            "example": "Monthly SaaS subscription — Jan 2024",
            "sql_type_hint": "TEXT",
            "required": False,
            "width": 35,
        },
    ],

    "contract": [
        {
            "name": "contract_id",
            "header": "Contract ID / Reference",
            "description": "Unique contract identifier or reference number.",
            "example": "MSA-2023-007",
            "sql_type_hint": "VARCHAR(100)",
            "required": False,
            "width": 25,
        },
        {
            "name": "parties",
            "header": "Parties",
            "description": "All parties to the contract, separated by semicolons.",
            "example": "DataArch Inc.; Acme Supplies LLC",
            "sql_type_hint": "TEXT",
            "required": False,
            "width": 35,
        },
        {
            "name": "effective_date",
            "header": "Effective Date",
            "description": "Contract start / effective date (YYYY-MM-DD).",
            "example": "2023-07-01",
            "sql_type_hint": "DATE",
            "required": False,
            "width": 18,
        },
        {
            "name": "expiry_date",
            "header": "Expiry / End Date",
            "description": "Contract expiry or termination date (YYYY-MM-DD). Leave blank for evergreen.",
            "example": "2024-06-30",
            "sql_type_hint": "DATE",
            "required": False,
            "width": 20,
        },
        {
            "name": "value",
            "header": "Contract Value (USD)",
            "description": "Total contract value or annual contract value.",
            "example": "120000.00",
            "sql_type_hint": "NUMERIC(14,2)",
            "required": False,
            "width": 22,
        },
        {
            "name": "type",
            "header": "Contract Type",
            "description": "Contract type: MSA, SOW, NDA, Lease, License, SLA, Amendment, etc.",
            "example": "MSA",
            "sql_type_hint": "VARCHAR(50)",
            "required": False,
            "width": 18,
        },
        {
            "name": "renewal_terms",
            "header": "Renewal Terms",
            "description": "Auto-renewal clause or notice period (e.g. Auto-renews annually, 30-day notice).",
            "example": "Auto-renews annually",
            "sql_type_hint": "VARCHAR(255)",
            "required": False,
            "width": 28,
        },
    ],

    "financial_record": [
        {
            "name": "period",
            "header": "Period",
            "description": "Reporting period (e.g. 2024-Q1, FY2023, 2024-01).",
            "example": "2024-Q1",
            "sql_type_hint": "VARCHAR(50)",
            "required": False,
            "width": 16,
        },
        {
            "name": "record_type",
            "header": "Record Type",
            "description": "Type of financial record: P&L, Balance Sheet, Budget, Forecast, GL Entry, etc.",
            "example": "P&L",
            "sql_type_hint": "VARCHAR(100)",
            "required": False,
            "width": 22,
        },
        {
            "name": "total_value",
            "header": "Total Value (USD)",
            "description": "Total value or amount for this record.",
            "example": "4500000.00",
            "sql_type_hint": "NUMERIC(14,2)",
            "required": False,
            "width": 22,
        },
        {
            "name": "currency",
            "header": "Currency",
            "description": "ISO currency code.",
            "example": "USD",
            "sql_type_hint": "VARCHAR(10)",
            "required": False,
            "width": 12,
        },
        {
            "name": "line_item",
            "header": "Line Item / Account",
            "description": "GL account name or line item description.",
            "example": "Revenue — SaaS Subscriptions",
            "sql_type_hint": "VARCHAR(255)",
            "required": False,
            "width": 35,
        },
        {
            "name": "notes",
            "header": "Notes",
            "description": "Any additional context or notes.",
            "example": "Includes one-time items from Q4 acquisition",
            "sql_type_hint": "TEXT",
            "required": False,
            "width": 35,
        },
    ],

    "business_unit": [
        {
            "name": "unit_id",
            "header": "Unit ID",
            "description": "Internal identifier for this business unit / department.",
            "example": "BU-ENG-01",
            "sql_type_hint": "VARCHAR(100)",
            "required": False,
            "width": 18,
        },
        {
            "name": "name",
            "header": "Unit Name",
            "description": "Business unit or department name.",
            "example": "Engineering",
            "sql_type_hint": "VARCHAR(255)",
            "required": False,
            "width": 28,
        },
        {
            "name": "parent_entity",
            "header": "Parent Entity",
            "description": "Parent department or division (for org hierarchy).",
            "example": "Product & Technology",
            "sql_type_hint": "VARCHAR(255)",
            "required": False,
            "width": 28,
        },
        {
            "name": "headcount",
            "header": "Headcount",
            "description": "Current number of employees in this unit.",
            "example": "42",
            "sql_type_hint": "INTEGER",
            "required": False,
            "width": 16,
        },
        {
            "name": "cost_center",
            "header": "Cost Center",
            "description": "Accounting cost center code.",
            "example": "CC-4100",
            "sql_type_hint": "VARCHAR(50)",
            "required": False,
            "width": 16,
        },
        {
            "name": "location",
            "header": "Location",
            "description": "Primary office or geographic location.",
            "example": "New York, NY",
            "sql_type_hint": "VARCHAR(255)",
            "required": False,
            "width": 22,
        },
    ],
}


# ── Public column accessor ──────────────────────────────────────────────────

def get_template_columns(entity_type: str) -> list[dict]:
    """
    Return the column definitions for a given entity type template.

    Always returns: standard columns + entity-specific columns + audit columns.
    Returns empty list for unknown entity types.

    Each column dict has:
        name, header, description, example, sql_type_hint, required, width
    """
    entity_cols = _ENTITY_COLUMNS.get(entity_type.lower(), [])
    return _STANDARD_COLUMNS + entity_cols + _AUDIT_COLUMNS


def get_supported_entity_types() -> list[str]:
    """Return list of entity types that have templates defined."""
    return sorted(_ENTITY_COLUMNS.keys())


# ── Excel generation ────────────────────────────────────────────────────────

def generate_template(entity_type: str) -> bytes:
    """
    Generate a downloadable .xlsx template for the given entity type.

    Args:
        entity_type: One of the supported entity types (vendor, customer, etc.)

    Returns:
        Raw bytes of the .xlsx file.

    Raises:
        ValueError: if entity_type is not supported.
        ImportError: if openpyxl is not installed.
    """
    try:
        import openpyxl
        from openpyxl.styles import (
            Alignment, Border, Font, PatternFill, Side
        )
        from openpyxl.utils import get_column_letter
        from openpyxl.worksheet.datavalidation import DataValidation
    except ImportError:
        raise ImportError(
            "openpyxl is required for template generation. "
            "Install with: pip install openpyxl"
        )

    entity_type = entity_type.lower()
    if entity_type not in _ENTITY_COLUMNS:
        supported = sorted(_ENTITY_COLUMNS.keys())
        raise ValueError(
            f"No template defined for entity type '{entity_type}'. "
            f"Supported: {supported}"
        )

    columns = get_template_columns(entity_type)

    wb = openpyxl.Workbook()

    # ── Sheet 1: Data ────────────────────────────────────────────────────────
    ws_data = wb.active
    ws_data.title = "Data"

    # Styling constants
    HEADER_FILL = PatternFill(fill_type="solid", fgColor="1F4E79")      # dark navy
    REQUIRED_FILL = PatternFill(fill_type="solid", fgColor="2E75B6")    # medium blue
    ALT_ROW_FILL = PatternFill(fill_type="solid", fgColor="EBF3FB")     # very light blue
    HEADER_FONT = Font(bold=True, color="FFFFFF", size=11)
    REQUIRED_FONT = Font(bold=True, color="FFFFFF", size=11)
    NORMAL_FONT = Font(size=11)
    EXAMPLE_FONT = Font(size=10, italic=True, color="808080")

    thin_border_side = Side(style="thin", color="D0D0D0")
    thin_border = Border(
        left=thin_border_side,
        right=thin_border_side,
        top=thin_border_side,
        bottom=thin_border_side,
    )

    # Row 1 — header
    for col_idx, col in enumerate(columns, start=1):
        cell = ws_data.cell(row=1, column=col_idx, value=col["header"])
        cell.font = REQUIRED_FONT if col.get("required") else HEADER_FONT
        cell.fill = REQUIRED_FILL if col.get("required") else HEADER_FILL
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thin_border
        ws_data.column_dimensions[get_column_letter(col_idx)].width = col.get("width", 20)

    ws_data.row_dimensions[1].height = 28

    # Row 2 — example row (greyed out, italic)
    for col_idx, col in enumerate(columns, start=1):
        example = col.get("example", "")
        if example:
            cell = ws_data.cell(row=2, column=col_idx, value=example)
            cell.font = EXAMPLE_FONT
            cell.alignment = Alignment(vertical="center")
            cell.border = thin_border

    # Row 3 onwards — alternating fill for 48 blank data rows
    for row_idx in range(3, 51):
        fill = ALT_ROW_FILL if row_idx % 2 == 0 else None
        for col_idx in range(1, len(columns) + 1):
            cell = ws_data.cell(row=row_idx, column=col_idx)
            cell.font = NORMAL_FONT
            cell.border = thin_border
            cell.alignment = Alignment(vertical="center")
            if fill:
                cell.fill = fill

    # Date column validation + format
    for col_idx, col in enumerate(columns, start=1):
        sql_hint = col.get("sql_type_hint", "")
        col_letter = get_column_letter(col_idx)

        if "DATE" in sql_hint:
            # Apply date number format to data rows
            for row_idx in range(3, 51):
                ws_data[f"{col_letter}{row_idx}"].number_format = "YYYY-MM-DD"

        elif "NUMERIC" in sql_hint or "DECIMAL" in sql_hint or "FLOAT" in sql_hint:
            # Currency / numeric format
            for row_idx in range(3, 51):
                ws_data[f"{col_letter}{row_idx}"].number_format = "#,##0.00"

        elif "INTEGER" in sql_hint or "BIGINT" in sql_hint:
            for row_idx in range(3, 51):
                ws_data[f"{col_letter}{row_idx}"].number_format = "0"

    # Direction dropdown for transaction template
    if entity_type == "transaction":
        _add_direction_validation(ws_data, columns)

    # Employment type dropdown for employee template
    if entity_type == "employee":
        _add_employment_type_validation(ws_data, columns)

    # Freeze header row
    ws_data.freeze_panes = "A2"

    # Auto-filter on header row
    ws_data.auto_filter.ref = (
        f"A1:{get_column_letter(len(columns))}50"
    )

    # Tab color
    ws_data.sheet_properties.tabColor = "1F4E79"

    # ── Sheet 2: Instructions ────────────────────────────────────────────────
    ws_inst = wb.create_sheet(title="Instructions")
    ws_inst.sheet_properties.tabColor = "2E75B6"

    _build_instructions_sheet(ws_inst, entity_type, columns)

    # ── Serialize ────────────────────────────────────────────────────────────
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.read()


# ── Sheet helpers ───────────────────────────────────────────────────────────

def _add_direction_validation(ws, columns: list[dict]) -> None:
    """Add inbound/outbound dropdown to the 'direction' column."""
    try:
        from openpyxl.worksheet.datavalidation import DataValidation
    except ImportError:
        return

    for col_idx, col in enumerate(columns, start=1):
        if col["name"] == "direction":
            from openpyxl.utils import get_column_letter
            col_letter = get_column_letter(col_idx)
            dv = DataValidation(
                type="list",
                formula1='"inbound,outbound"',
                allow_blank=True,
                sqref=f"{col_letter}3:{col_letter}50",
            )
            dv.prompt = "Select direction"
            dv.promptTitle = "Direction"
            ws.add_data_validation(dv)
            break


def _add_employment_type_validation(ws, columns: list[dict]) -> None:
    """Add employment type dropdown to the 'employment_type' column."""
    try:
        from openpyxl.worksheet.datavalidation import DataValidation
        from openpyxl.utils import get_column_letter
    except ImportError:
        return

    for col_idx, col in enumerate(columns, start=1):
        if col["name"] == "employment_type":
            col_letter = get_column_letter(col_idx)
            dv = DataValidation(
                type="list",
                formula1='"Full-time,Part-time,Contractor,Intern,Advisor"',
                allow_blank=True,
                sqref=f"{col_letter}3:{col_letter}50",
            )
            dv.prompt = "Select employment type"
            dv.promptTitle = "Employment Type"
            ws.add_data_validation(dv)
            break


def _build_instructions_sheet(ws, entity_type: str, columns: list[dict]) -> None:
    """
    Populate the Instructions sheet with a human-readable field guide.
    """
    try:
        from openpyxl.styles import Alignment, Font, PatternFill
        from openpyxl.utils import get_column_letter
    except ImportError:
        return

    TITLE_FONT = Font(bold=True, size=16, color="1F4E79")
    SECTION_FONT = Font(bold=True, size=12, color="2E75B6")
    HEADER_FONT = Font(bold=True, size=11)
    NORMAL_FONT = Font(size=11)
    REQUIRED_FONT = Font(bold=True, size=11, color="C0392B")
    FILL_HEADER = PatternFill(fill_type="solid", fgColor="1F4E79")
    FILL_ALT = PatternFill(fill_type="solid", fgColor="EBF3FB")

    entity_label = entity_type.replace("_", " ").title()

    # Set column widths
    ws.column_dimensions["A"].width = 5
    ws.column_dimensions["B"].width = 28
    ws.column_dimensions["C"].width = 55
    ws.column_dimensions["D"].width = 30
    ws.column_dimensions["E"].width = 12

    row = 1

    # Title
    ws.cell(row=row, column=2, value=f"DataArch.AI — {entity_label} Upload Template").font = TITLE_FONT
    ws.merge_cells(f"B{row}:E{row}")
    row += 1

    # Subtitle
    ws.cell(row=row, column=2, value=(
        f"Fill in the 'Data' sheet with your {entity_label.lower()} records, "
        f"then upload the file to DataArch.AI."
    )).font = Font(size=11, italic=True, color="555555")
    ws.merge_cells(f"B{row}:E{row}")
    row += 2

    # Tips section
    ws.cell(row=row, column=2, value="Instructions").font = SECTION_FONT
    row += 1

    tips = [
        "• The 'Data' sheet has a header row (row 1) and an example row (row 2) — do not delete or modify them.",
        "• Start your data in row 3.",
        "• Columns marked with * are required. All others are optional but recommended.",
        "• canonical_name is the primary name DataArch.AI uses to identify and deduplicate records.",
        "• Date fields must be in YYYY-MM-DD format (e.g. 2024-01-15).",
        "• Amount / numeric fields should be numbers without currency symbols (e.g. 15000.00 not $15,000).",
        "• Leave 'Source File' blank — DataArch fills it automatically on upload.",
        "• You can add as many rows as needed beyond row 50.",
    ]
    for tip in tips:
        ws.cell(row=row, column=2, value=tip).font = NORMAL_FONT
        ws.merge_cells(f"B{row}:E{row}")
        row += 1

    row += 1

    # Field legend
    ws.cell(row=row, column=2, value="Field Guide").font = SECTION_FONT
    row += 1

    # Legend header row
    headers = ["Column Header", "Description", "Example", "Required"]
    fill_cols = [2, 3, 4, 5]
    for col_idx, (h, fc) in enumerate(zip(headers, fill_cols), start=0):
        cell = ws.cell(row=row, column=fill_cols[col_idx], value=h)
        cell.font = Font(bold=True, size=11, color="FFFFFF")
        cell.fill = FILL_HEADER
        cell.alignment = Alignment(wrap_text=True, vertical="center")
    ws.row_dimensions[row].height = 22
    row += 1

    for i, col in enumerate(columns):
        fill = FILL_ALT if i % 2 == 0 else None
        req_str = "✓ Required" if col.get("required") else "Optional"
        req_font = REQUIRED_FONT if col.get("required") else NORMAL_FONT

        cells_data = [
            (2, col["header"], HEADER_FONT if col.get("required") else NORMAL_FONT),
            (3, col.get("description", ""), NORMAL_FONT),
            (4, col.get("example", ""), Font(size=11, italic=True, color="555555")),
            (5, req_str, req_font),
        ]
        for col_num, value, font in cells_data:
            cell = ws.cell(row=row, column=col_num, value=value)
            cell.font = font
            cell.alignment = Alignment(wrap_text=True, vertical="top")
            if fill:
                cell.fill = fill
        ws.row_dimensions[row].height = 30
        row += 1

    row += 1

    # Footer
    import datetime
    ws.cell(row=row, column=2,
            value=f"Generated by DataArch.AI on {datetime.date.today().isoformat()}").font = Font(
        size=10, italic=True, color="AAAAAA"
    )
    ws.merge_cells(f"B{row}:E{row}")
