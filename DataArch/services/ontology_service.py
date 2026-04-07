"""
services/ontology_service.py — Central ontology service for DataArch.AI.

All modules that need ontology type information should import from this
module instead of using hardcoded enums, lists, or dicts.

Features:
  - DB-backed ontology types with in-memory cache
  - 5-minute cache TTL with manual invalidation
  - Graceful fallback to seed defaults if DB is unavailable
  - Dynamic prompt generation for the LLM classifier
"""

from __future__ import annotations

import logging
import time
from typing import Optional

from sqlalchemy import text

log = logging.getLogger(__name__)

# ── Cache ──────────────────────────────────────────────────────────────────

_cache: dict | None = None
_cache_time: float = 0
CACHE_TTL: int = 300  # 5 minutes


def invalidate_cache() -> None:
    """Force the cache to refresh on next access."""
    global _cache, _cache_time
    _cache = None
    _cache_time = 0
    log.info("Ontology cache invalidated.")


def _get_cache() -> dict:
    """Return cached ontology data, refreshing from DB if stale."""
    global _cache, _cache_time

    if _cache is not None and (time.time() - _cache_time) < CACHE_TTL:
        return _cache

    try:
        _cache = _load_from_db()
        _cache_time = time.time()
        return _cache
    except Exception as e:
        log.warning("Failed to load ontology from DB: %s. Using fallback.", e)
        if _cache is not None:
            return _cache
        _cache = _load_fallback()
        _cache_time = time.time()
        return _cache


def _load_from_db() -> dict:
    """Load all ontology data from the database."""
    from pipeline.database import get_engine

    engine = get_engine()
    with engine.connect() as conn:
        # ── Types ────────────────────────────────────────────────
        rows = conn.execute(text("""
            SELECT id, name, display_label, display_color, icon, description,
                   classification_examples, is_entity_table, is_resolvable,
                   sort_order, is_active, fund_id
            FROM ontology_types
            WHERE is_active = true
            ORDER BY sort_order, name
        """)).fetchall()

        types = []
        type_id_map = {}
        for r in rows:
            t = {
                "id": r.id,
                "name": r.name,
                "display_label": r.display_label,
                "display_color": r.display_color,
                "icon": r.icon,
                "description": r.description,
                "classification_examples": r.classification_examples,
                "is_entity_table": r.is_entity_table,
                "is_resolvable": r.is_resolvable,
                "sort_order": r.sort_order,
                "fund_id": r.fund_id,
            }
            types.append(t)
            type_id_map[r.id] = r.name

        # ── FK Rules ────────────────────────────────────────────
        fk_rows = conn.execute(text("""
            SELECT child_type_id, parent_type_id, column_name
            FROM ontology_type_fk_rules
            WHERE is_active = true
        """)).fetchall()

        fk_rules = []
        for r in fk_rows:
            child = type_id_map.get(r.child_type_id)
            parent = type_id_map.get(r.parent_type_id)
            if child and parent:
                fk_rules.append({
                    "child": child,
                    "parent": parent,
                    "column": r.column_name,
                })

        # ── Attributes ──────────────────────────────────────────
        attr_rows = conn.execute(text("""
            SELECT ontology_type_id, attribute_name, description,
                   is_key_attribute, sql_type_hint, sort_order
            FROM ontology_type_attributes
            ORDER BY ontology_type_id, sort_order
        """)).fetchall()

        attributes: dict[str, list[dict]] = {}
        for r in attr_rows:
            type_name = type_id_map.get(r.ontology_type_id)
            if type_name:
                attributes.setdefault(type_name, []).append({
                    "attribute_name": r.attribute_name,
                    "description": r.description,
                    "is_key_attribute": r.is_key_attribute,
                    "sql_type_hint": r.sql_type_hint,
                    "sort_order": r.sort_order,
                })

    log.info("Loaded %d ontology types from database.", len(types))
    return {
        "types": types,
        "fk_rules": fk_rules,
        "attributes": attributes,
        "type_id_map": type_id_map,
    }


def _load_fallback() -> dict:
    """Load ontology from hardcoded seed defaults when DB is unavailable."""
    from seeds.ontology_defaults import DEFAULT_ATTRIBUTES, DEFAULT_FK_RULES, DEFAULT_TYPES

    log.info("Using hardcoded ontology defaults (DB unavailable).")
    types = []
    for i, t in enumerate(DEFAULT_TYPES):
        types.append({
            "id": i + 1,
            "name": t["name"],
            "display_label": t["display_label"],
            "display_color": t["display_color"],
            "icon": t.get("icon"),
            "description": t.get("description"),
            "classification_examples": t.get("classification_examples"),
            "is_entity_table": t.get("is_entity_table", True),
            "is_resolvable": t.get("is_resolvable", True),
            "sort_order": t.get("sort_order", 0),
            "fund_id": None,
        })

    return {
        "types": types,
        "fk_rules": DEFAULT_FK_RULES,
        "attributes": DEFAULT_ATTRIBUTES,
        "type_id_map": {i + 1: t["name"] for i, t in enumerate(DEFAULT_TYPES)},
    }


# ── Public API ─────────────────────────────────────────────────────────────

def get_ontology_types() -> list[dict]:
    """Return all active ontology types from DB (cached)."""
    return _get_cache()["types"]


def get_type_names() -> list[str]:
    """Return list of all active type names (e.g., ['vendor', 'customer', ...])."""
    return [t["name"] for t in get_ontology_types()]


def get_entity_table_names() -> list[str]:
    """Return table names for types that have entity tables."""
    return [t["name"] for t in get_ontology_types() if t["is_entity_table"]]


def get_resolvable_table_names() -> list[str]:
    """Return table names for types that support entity resolution."""
    return [t["name"] for t in get_ontology_types() if t["is_resolvable"]]


def get_fk_rules() -> list[dict]:
    """Return all active FK rules: [{"child": str, "parent": str, "column": str}]."""
    return _get_cache()["fk_rules"]


def get_fk_rules_dict() -> dict[tuple[str, str], str]:
    """Return FK rules as {(child_type, column_name): parent_type}."""
    return {(r["child"], r["column"]): r["parent"] for r in get_fk_rules()}


def get_company_fk_rules() -> dict[str, str]:
    """Return {entity_type: 'portfolio_company'} for all entity table types."""
    return {name: "portfolio_company" for name in get_entity_table_names()}


def get_type_colors() -> dict[str, str]:
    """Return {type_name: hex_color} mapping."""
    return {t["name"]: t["display_color"] for t in get_ontology_types()}


def get_type_labels() -> dict[str, str]:
    """Return {type_name: display_label} mapping."""
    return {t["name"]: t["display_label"] for t in get_ontology_types() if t["name"] != "unknown"}


def get_type_attributes() -> dict[str, list[dict]]:
    """Return attributes grouped by type name."""
    return _get_cache()["attributes"]


# ── Classifier Prompt Generation ───────────────────────────────────────────

def get_classification_spec() -> str:
    """Generate the ONTOLOGY_SPEC prompt string from DB types.

    Mirrors the format of the original hardcoded ONTOLOGY_SPEC.
    """
    lines = ["PE Business Ontology — canonical types and example raw names:\n"]

    for t in get_ontology_types():
        lines.append(t["name"].upper())
        if t.get("classification_examples"):
            lines.append(f"  Examples: {t['classification_examples']}")

        # Add key attributes
        attrs = _get_cache()["attributes"].get(t["name"], [])
        key_attrs = [a["attribute_name"] for a in attrs if a.get("is_key_attribute")]
        all_attrs = [a["attribute_name"] for a in attrs]
        display_attrs = key_attrs or all_attrs[:4]
        if display_attrs:
            lines.append(f"  Key attributes: {', '.join(display_attrs)}")

        lines.append("")

    return "\n".join(lines)


def get_classification_tool_enum() -> list[str]:
    """Return the enum values for the CLASSIFICATION_TOOL schema.

    Always includes 'unknown' as the last option.
    """
    names = [t["name"] for t in get_ontology_types() if t["name"] != "unknown"]
    names.append("unknown")
    return names
