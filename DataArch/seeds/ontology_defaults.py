"""
seeds/ontology_defaults.py — Default ontology types, FK rules, and attributes.

These mirror the values currently hardcoded across the pipeline modules.
Run via `python -m seeds.ontology_defaults` or called from app startup.
"""

from __future__ import annotations

import logging
from sqlalchemy import text
from sqlalchemy.engine import Connection

log = logging.getLogger(__name__)

# ── Default Ontology Types ─────────────────────────────────────────────────

DEFAULT_TYPES: list[dict] = [
    {
        "name": "vendor",
        "display_label": "Vendors",
        "display_color": "#4A90D9",
        "icon": "building",
        "description": "Suppliers, service providers, and counterparties.",
        "classification_examples": (
            "supplier, counterparty, service provider, contractor, subcontractor, "
            "payee, merchant, vendor, fulfillment partner"
        ),
        "is_entity_table": True,
        "is_resolvable": True,
        "sort_order": 1,
    },
    {
        "name": "customer",
        "display_label": "Customers",
        "display_color": "#50C878",
        "icon": "users",
        "description": "Clients, accounts, and buyers.",
        "classification_examples": (
            "client, account, buyer, end customer, subscriber, billable entity"
        ),
        "is_entity_table": True,
        "is_resolvable": True,
        "sort_order": 2,
    },
    {
        "name": "employee",
        "display_label": "Employees",
        "display_color": "#F5A623",
        "icon": "user",
        "description": "Staff members, team members, and headcount records.",
        "classification_examples": (
            "staff member, headcount, team member, payee (HR), contractor (HR)"
        ),
        "is_entity_table": True,
        "is_resolvable": True,
        "sort_order": 3,
    },
    {
        "name": "product",
        "display_label": "Products",
        "display_color": "#9B59B6",
        "icon": "box",
        "description": "SKUs, line items, and service offerings.",
        "classification_examples": (
            "SKU, line item, service offering, subscription tier, good, material"
        ),
        "is_entity_table": True,
        "is_resolvable": True,
        "sort_order": 4,
    },
    {
        "name": "transaction",
        "display_label": "Transactions",
        "display_color": "#E74C3C",
        "icon": "credit-card",
        "description": "Invoices, payments, purchase orders, and financial movements.",
        "classification_examples": (
            "invoice, payment, purchase order, bill, receipt, wire transfer, "
            "expense, charge, credit note, debit, journal entry"
        ),
        "is_entity_table": True,
        "is_resolvable": False,
        "sort_order": 5,
    },
    {
        "name": "contract",
        "display_label": "Contracts",
        "display_color": "#1ABC9C",
        "icon": "file-text",
        "description": "Agreements, MSAs, SOWs, leases, and legal documents.",
        "classification_examples": (
            "agreement, MSA, SOW, lease, NDA, license, SLA, amendment, addendum"
        ),
        "is_entity_table": True,
        "is_resolvable": True,
        "sort_order": 6,
    },
    {
        "name": "financial_record",
        "display_label": "Financial Records",
        "display_color": "#F39C12",
        "icon": "dollar-sign",
        "description": "P&L, balance sheets, budgets, and general ledger entries.",
        "classification_examples": (
            "P&L, balance sheet, income statement, trial balance, budget, "
            "forecast, general ledger, chart of accounts"
        ),
        "is_entity_table": True,
        "is_resolvable": False,
        "sort_order": 7,
    },
    {
        "name": "business_unit",
        "display_label": "Business Units",
        "display_color": "#3498DB",
        "icon": "layers",
        "description": "Divisions, departments, subsidiaries, and organizational entities.",
        "classification_examples": (
            "division, department, subsidiary, entity, location, plant, region"
        ),
        "is_entity_table": True,
        "is_resolvable": True,
        "sort_order": 8,
    },
    {
        "name": "unknown",
        "display_label": "Unknown",
        "display_color": "#95A5A6",
        "icon": "help-circle",
        "description": "Entities that cannot be confidently classified.",
        "classification_examples": None,
        "is_entity_table": False,
        "is_resolvable": False,
        "sort_order": 99,
    },
]

# ── Default FK Rules ───────────────────────────────────────────────────────
# (child_type_name, column_name) → parent_type_name

DEFAULT_FK_RULES: list[dict] = [
    {"child": "transaction", "column": "vendor_id", "parent": "vendor"},
    {"child": "transaction", "column": "customer_id", "parent": "customer"},
    {"child": "transaction", "column": "product_id", "parent": "product"},
    {"child": "contract", "column": "vendor_id", "parent": "vendor"},
    {"child": "contract", "column": "customer_id", "parent": "customer"},
    {"child": "employee", "column": "department", "parent": "business_unit"},
    {"child": "product", "column": "vendor_id", "parent": "vendor"},
]

# ── Default Key Attributes per Type ────────────────────────────────────────

DEFAULT_ATTRIBUTES: dict[str, list[dict]] = {
    "vendor": [
        {"attribute_name": "vendor_id", "is_key_attribute": True, "sql_type_hint": "VARCHAR(100)", "sort_order": 1},
        {"attribute_name": "legal_name", "is_key_attribute": True, "sql_type_hint": "VARCHAR(255)", "sort_order": 2},
        {"attribute_name": "payment_terms", "is_key_attribute": False, "sql_type_hint": "VARCHAR(100)", "sort_order": 3},
        {"attribute_name": "category", "is_key_attribute": False, "sql_type_hint": "VARCHAR(100)", "sort_order": 4},
    ],
    "customer": [
        {"attribute_name": "customer_id", "is_key_attribute": True, "sql_type_hint": "VARCHAR(100)", "sort_order": 1},
        {"attribute_name": "legal_name", "is_key_attribute": True, "sql_type_hint": "VARCHAR(255)", "sort_order": 2},
        {"attribute_name": "segment", "is_key_attribute": False, "sql_type_hint": "VARCHAR(100)", "sort_order": 3},
        {"attribute_name": "revenue_tier", "is_key_attribute": False, "sql_type_hint": "VARCHAR(50)", "sort_order": 4},
    ],
    "employee": [
        {"attribute_name": "employee_id", "is_key_attribute": True, "sql_type_hint": "VARCHAR(100)", "sort_order": 1},
        {"attribute_name": "role", "is_key_attribute": False, "sql_type_hint": "VARCHAR(100)", "sort_order": 2},
        {"attribute_name": "department", "is_key_attribute": False, "sql_type_hint": "VARCHAR(100)", "sort_order": 3},
        {"attribute_name": "compensation_band", "is_key_attribute": False, "sql_type_hint": "VARCHAR(50)", "sort_order": 4},
    ],
    "product": [
        {"attribute_name": "product_id", "is_key_attribute": True, "sql_type_hint": "VARCHAR(100)", "sort_order": 1},
        {"attribute_name": "name", "is_key_attribute": True, "sql_type_hint": "VARCHAR(255)", "sort_order": 2},
        {"attribute_name": "unit_price", "is_key_attribute": False, "sql_type_hint": "NUMERIC(12,2)", "sort_order": 3},
        {"attribute_name": "category", "is_key_attribute": False, "sql_type_hint": "VARCHAR(100)", "sort_order": 4},
        {"attribute_name": "revenue_type", "is_key_attribute": False, "sql_type_hint": "VARCHAR(50)", "sort_order": 5},
    ],
    "transaction": [
        {"attribute_name": "transaction_id", "is_key_attribute": True, "sql_type_hint": "VARCHAR(100)", "sort_order": 1},
        {"attribute_name": "amount", "is_key_attribute": False, "sql_type_hint": "NUMERIC(14,2)", "sort_order": 2},
        {"attribute_name": "currency", "is_key_attribute": False, "sql_type_hint": "VARCHAR(10)", "sort_order": 3},
        {"attribute_name": "date", "is_key_attribute": False, "sql_type_hint": "DATE", "sort_order": 4},
        {"attribute_name": "counterparty", "is_key_attribute": False, "sql_type_hint": "VARCHAR(255)", "sort_order": 5},
        {"attribute_name": "direction", "is_key_attribute": False, "sql_type_hint": "VARCHAR(20)", "sort_order": 6},
    ],
    "contract": [
        {"attribute_name": "contract_id", "is_key_attribute": True, "sql_type_hint": "VARCHAR(100)", "sort_order": 1},
        {"attribute_name": "parties", "is_key_attribute": False, "sql_type_hint": "TEXT", "sort_order": 2},
        {"attribute_name": "effective_date", "is_key_attribute": False, "sql_type_hint": "DATE", "sort_order": 3},
        {"attribute_name": "expiry_date", "is_key_attribute": False, "sql_type_hint": "DATE", "sort_order": 4},
        {"attribute_name": "value", "is_key_attribute": False, "sql_type_hint": "NUMERIC(14,2)", "sort_order": 5},
        {"attribute_name": "type", "is_key_attribute": False, "sql_type_hint": "VARCHAR(50)", "sort_order": 6},
    ],
    "financial_record": [
        {"attribute_name": "period", "is_key_attribute": True, "sql_type_hint": "VARCHAR(50)", "sort_order": 1},
        {"attribute_name": "record_type", "is_key_attribute": True, "sql_type_hint": "VARCHAR(100)", "sort_order": 2},
        {"attribute_name": "total_value", "is_key_attribute": False, "sql_type_hint": "NUMERIC(14,2)", "sort_order": 3},
        {"attribute_name": "currency", "is_key_attribute": False, "sql_type_hint": "VARCHAR(10)", "sort_order": 4},
    ],
    "business_unit": [
        {"attribute_name": "unit_id", "is_key_attribute": True, "sql_type_hint": "VARCHAR(100)", "sort_order": 1},
        {"attribute_name": "name", "is_key_attribute": True, "sql_type_hint": "VARCHAR(255)", "sort_order": 2},
        {"attribute_name": "parent_entity", "is_key_attribute": False, "sql_type_hint": "VARCHAR(255)", "sort_order": 3},
        {"attribute_name": "headcount", "is_key_attribute": False, "sql_type_hint": "INTEGER", "sort_order": 4},
    ],
}


# ── Seed Function ──────────────────────────────────────────────────────────

def seed_ontology_defaults(conn: Connection) -> None:
    """Insert default ontology types, FK rules, and attributes if the
    ontology_types table is empty.

    Safe to call on every startup — it's a no-op when data already exists.
    """
    result = conn.execute(text("SELECT COUNT(*) FROM ontology_types"))
    count = result.scalar()
    if count and count > 0:
        log.info("ontology_types already seeded (%d rows) — skipping.", count)
        return

    log.info("Seeding default ontology types ...")

    # ── Insert types ─────────────────────────────────────────────────
    type_id_map: dict[str, int] = {}

    for t in DEFAULT_TYPES:
        result = conn.execute(
            text("""
                INSERT INTO ontology_types
                    (name, display_label, display_color, icon, description,
                     classification_examples, is_entity_table, is_resolvable,
                     sort_order, is_active)
                VALUES
                    (:name, :display_label, :display_color, :icon, :description,
                     :classification_examples, :is_entity_table, :is_resolvable,
                     :sort_order, true)
                RETURNING id
            """),
            t,
        )
        type_id = result.scalar()
        type_id_map[t["name"]] = type_id

    log.info("  Inserted %d ontology types.", len(DEFAULT_TYPES))

    # ── Insert FK rules ──────────────────────────────────────────────
    for rule in DEFAULT_FK_RULES:
        child_id = type_id_map.get(rule["child"])
        parent_id = type_id_map.get(rule["parent"])
        if child_id and parent_id:
            conn.execute(
                text("""
                    INSERT INTO ontology_type_fk_rules
                        (child_type_id, parent_type_id, column_name, is_active)
                    VALUES
                        (:child_id, :parent_id, :column_name, true)
                """),
                {"child_id": child_id, "parent_id": parent_id, "column_name": rule["column"]},
            )

    log.info("  Inserted %d FK rules.", len(DEFAULT_FK_RULES))

    # ── Insert attributes ────────────────────────────────────────────
    attr_count = 0
    for type_name, attrs in DEFAULT_ATTRIBUTES.items():
        type_id = type_id_map.get(type_name)
        if not type_id:
            continue
        for attr in attrs:
            conn.execute(
                text("""
                    INSERT INTO ontology_type_attributes
                        (ontology_type_id, attribute_name, is_key_attribute,
                         sql_type_hint, sort_order)
                    VALUES
                        (:type_id, :attribute_name, :is_key_attribute,
                         :sql_type_hint, :sort_order)
                """),
                {"type_id": type_id, **attr},
            )
            attr_count += 1

    log.info("  Inserted %d type attributes.", attr_count)
    conn.commit()
    log.info("Ontology seeding complete.")


# ── CLI entry point ────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    sys.path.insert(0, ".")
    from config import DATABASE_URL
    from sqlalchemy import create_engine

    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        seed_ontology_defaults(conn)
