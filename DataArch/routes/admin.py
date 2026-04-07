"""
routes/admin.py — Admin endpoints (pe_admin only).

Ontology CRUD:
  GET    /admin/ontology/types            List all types
  POST   /admin/ontology/types            Create new type
  PUT    /admin/ontology/types/{id}       Update type
  DELETE /admin/ontology/types/{id}       Soft-delete type
  GET    /admin/ontology/fk-rules         List FK rules
  POST   /admin/ontology/fk-rules         Create FK rule
  DELETE /admin/ontology/fk-rules/{id}    Remove FK rule
  POST   /admin/ontology/types/{id}/attributes  Add attribute
  POST   /admin/ontology/invalidate-cache       Force cache refresh
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import text

from auth import TokenUser, require_role
from models import UserRole
from pipeline.database import get_engine
from services.ontology_service import invalidate_cache

router = APIRouter(prefix="/admin", tags=["admin"])

# All admin endpoints require pe_admin role
admin_dep = require_role([UserRole.PE_ADMIN])


# ── Request Models ─────────────────────────────────────────────────────────

class OntologyTypeCreate(BaseModel):
    name: str
    display_label: str
    display_color: str = "#6b6b7a"
    icon: str | None = None
    description: str | None = None
    classification_examples: str | None = None
    is_entity_table: bool = True
    is_resolvable: bool = True
    sort_order: int = 0


class OntologyTypeUpdate(BaseModel):
    display_label: str | None = None
    display_color: str | None = None
    icon: str | None = None
    description: str | None = None
    classification_examples: str | None = None
    is_entity_table: bool | None = None
    is_resolvable: bool | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class FkRuleCreate(BaseModel):
    child_type_id: int
    parent_type_id: int
    column_name: str


class AttributeCreate(BaseModel):
    attribute_name: str
    description: str | None = None
    is_key_attribute: bool = False
    sql_type_hint: str | None = None
    sort_order: int = 0


# ── Ontology Types ─────────────────────────────────────────────────────────

@router.get("/ontology/types")
def list_ontology_types(user: TokenUser = Depends(admin_dep)):
    """List all ontology types (including inactive)."""
    engine = get_engine()
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT id, name, display_label, display_color, icon, description,
                   classification_examples, is_entity_table, is_resolvable,
                   sort_order, is_active, fund_id, created_at, updated_at
            FROM ontology_types
            ORDER BY sort_order, name
        """)).fetchall()

    types = []
    for r in rows:
        types.append({
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
            "is_active": r.is_active,
            "fund_id": r.fund_id,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        })

    return JSONResponse(content={"types": types, "count": len(types)})


@router.post("/ontology/types", status_code=201)
def create_ontology_type(body: OntologyTypeCreate, user: TokenUser = Depends(admin_dep)):
    """Create a new ontology type."""
    engine = get_engine()
    with engine.connect() as conn:
        # Check for duplicate name
        existing = conn.execute(
            text("SELECT id FROM ontology_types WHERE name = :name"),
            {"name": body.name.lower().strip()},
        ).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail=f"Ontology type '{body.name}' already exists.")

        result = conn.execute(
            text("""
                INSERT INTO ontology_types
                    (name, display_label, display_color, icon, description,
                     classification_examples, is_entity_table, is_resolvable,
                     sort_order, is_active, created_at, updated_at)
                VALUES
                    (:name, :display_label, :display_color, :icon, :description,
                     :classification_examples, :is_entity_table, :is_resolvable,
                     :sort_order, true, NOW(), NOW())
                RETURNING id
            """),
            {
                "name": body.name.lower().strip(),
                "display_label": body.display_label,
                "display_color": body.display_color,
                "icon": body.icon,
                "description": body.description,
                "classification_examples": body.classification_examples,
                "is_entity_table": body.is_entity_table,
                "is_resolvable": body.is_resolvable,
                "sort_order": body.sort_order,
            },
        )
        new_id = result.scalar()
        conn.commit()

    invalidate_cache()
    return {"id": new_id, "name": body.name.lower().strip(), "message": "Created."}


@router.put("/ontology/types/{type_id}")
def update_ontology_type(type_id: int, body: OntologyTypeUpdate, user: TokenUser = Depends(admin_dep)):
    """Update an ontology type."""
    updates = []
    params: dict = {"tid": type_id}

    for field in ("display_label", "display_color", "icon", "description",
                  "classification_examples", "is_entity_table", "is_resolvable",
                  "sort_order", "is_active"):
        val = getattr(body, field, None)
        if val is not None:
            updates.append(f"{field} = :{field}")
            params[field] = val

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update.")

    updates.append("updated_at = NOW()")
    set_clause = ", ".join(updates)

    engine = get_engine()
    with engine.connect() as conn:
        result = conn.execute(
            text(f"UPDATE ontology_types SET {set_clause} WHERE id = :tid RETURNING id"),
            params,
        )
        if not result.fetchone():
            raise HTTPException(status_code=404, detail=f"Type {type_id} not found.")
        conn.commit()

    invalidate_cache()
    return {"id": type_id, "message": "Updated."}


@router.delete("/ontology/types/{type_id}")
def delete_ontology_type(type_id: int, user: TokenUser = Depends(admin_dep)):
    """Soft-delete (deactivate) an ontology type."""
    engine = get_engine()
    with engine.connect() as conn:
        result = conn.execute(
            text("UPDATE ontology_types SET is_active = false, updated_at = NOW() WHERE id = :tid RETURNING id"),
            {"tid": type_id},
        )
        if not result.fetchone():
            raise HTTPException(status_code=404, detail=f"Type {type_id} not found.")
        conn.commit()

    invalidate_cache()
    return {"id": type_id, "message": "Deactivated."}


# ── FK Rules ───────────────────────────────────────────────────────────────

@router.get("/ontology/fk-rules")
def list_fk_rules(user: TokenUser = Depends(admin_dep)):
    """List all FK rules with type names."""
    engine = get_engine()
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT r.id, r.child_type_id, r.parent_type_id, r.column_name,
                   r.is_active, c.name as child_name, p.name as parent_name
            FROM ontology_type_fk_rules r
            JOIN ontology_types c ON r.child_type_id = c.id
            JOIN ontology_types p ON r.parent_type_id = p.id
            ORDER BY c.name, r.column_name
        """)).fetchall()

    rules = [{
        "id": r.id,
        "child_type_id": r.child_type_id,
        "child_name": r.child_name,
        "parent_type_id": r.parent_type_id,
        "parent_name": r.parent_name,
        "column_name": r.column_name,
        "is_active": r.is_active,
    } for r in rows]

    return JSONResponse(content={"rules": rules, "count": len(rules)})


@router.post("/ontology/fk-rules", status_code=201)
def create_fk_rule(body: FkRuleCreate, user: TokenUser = Depends(admin_dep)):
    """Create a new FK rule."""
    engine = get_engine()
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                INSERT INTO ontology_type_fk_rules
                    (child_type_id, parent_type_id, column_name, is_active, created_at)
                VALUES (:child_id, :parent_id, :column_name, true, NOW())
                RETURNING id
            """),
            {"child_id": body.child_type_id, "parent_id": body.parent_type_id, "column_name": body.column_name},
        )
        new_id = result.scalar()
        conn.commit()

    invalidate_cache()
    return {"id": new_id, "message": "Created."}


@router.delete("/ontology/fk-rules/{rule_id}")
def delete_fk_rule(rule_id: int, user: TokenUser = Depends(admin_dep)):
    """Remove a FK rule."""
    engine = get_engine()
    with engine.connect() as conn:
        result = conn.execute(
            text("DELETE FROM ontology_type_fk_rules WHERE id = :rid RETURNING id"),
            {"rid": rule_id},
        )
        if not result.fetchone():
            raise HTTPException(status_code=404, detail=f"FK rule {rule_id} not found.")
        conn.commit()

    invalidate_cache()
    return {"id": rule_id, "message": "Deleted."}


# ── Attributes ─────────────────────────────────────────────────────────────

@router.post("/ontology/types/{type_id}/attributes", status_code=201)
def add_type_attribute(type_id: int, body: AttributeCreate, user: TokenUser = Depends(admin_dep)):
    """Add an attribute to an ontology type."""
    engine = get_engine()
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                INSERT INTO ontology_type_attributes
                    (ontology_type_id, attribute_name, description,
                     is_key_attribute, sql_type_hint, sort_order, created_at)
                VALUES (:type_id, :attr_name, :description,
                        :is_key, :sql_type_hint, :sort_order, NOW())
                RETURNING id
            """),
            {
                "type_id": type_id,
                "attr_name": body.attribute_name,
                "description": body.description,
                "is_key": body.is_key_attribute,
                "sql_type_hint": body.sql_type_hint,
                "sort_order": body.sort_order,
            },
        )
        new_id = result.scalar()
        conn.commit()

    invalidate_cache()
    return {"id": new_id, "message": "Attribute added."}


# ── Cache Management ───────────────────────────────────────────────────────

@router.post("/ontology/invalidate-cache")
def invalidate_ontology_cache(user: TokenUser = Depends(admin_dep)):
    """Force refresh of the ontology type cache."""
    invalidate_cache()
    return {"message": "Cache invalidated. Next request will reload from database."}
