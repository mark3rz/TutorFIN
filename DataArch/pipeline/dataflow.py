"""
pipeline/dataflow.py — Layer 4: Data flow graph generator for DataArch.AI.

Reads the EntityRegistry and generated schema to produce a graph structure
showing how ontology objects relate to each other. The graph is consumed
by the D3.js force-directed visualisation in frontend/dataflow.html.

Output:
  - A JSON graph with nodes (ontology types + individual entities) and
    edges (foreign key relationships between types).
"""

from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

from pipeline.ontology.schema import EntityRegistry, OntologyType
from pipeline.schema_generator import (
    FK_RULES,
    SCHEMA_OUTPUT_DIR,
    REGISTRY_PATH,
    generate_schema,
    load_registry,
)

DATAFLOW_OUTPUT_DIR = Path("outputs/dataflow")

# Colors for each ontology type (consistent across UI)
TYPE_COLORS: dict[str, str] = {
    "vendor":           "#4A90D9",
    "customer":         "#50C878",
    "employee":         "#F5A623",
    "product":          "#9B59B6",
    "transaction":      "#E74C3C",
    "contract":         "#1ABC9C",
    "financial_record": "#F39C12",
    "business_unit":    "#3498DB",
    "unknown":          "#95A5A6",
}

TYPE_LABELS: dict[str, str] = {
    "vendor":           "Vendors",
    "customer":         "Customers",
    "employee":         "Employees",
    "product":          "Products",
    "transaction":      "Transactions",
    "contract":         "Contracts",
    "financial_record": "Financial Records",
    "business_unit":    "Business Units",
}


def build_graph(registry: EntityRegistry, schema: dict | None = None) -> dict:
    """
    Build a graph structure from the EntityRegistry and schema.

    Returns:
      {
        "nodes": [
          {"id": "vendor", "label": "Vendors", "type": "group", "color": "#...",
           "entity_count": 5, "entities": [{"name": "...", "confidence": "high"}, ...]}
        ],
        "edges": [
          {"source": "transaction", "target": "vendor", "label": "vendor_id", "type": "fk"}
        ],
        "stats": {"total_entities": N, "total_types": N, "total_relationships": N},
        "generated_at": "..."
      }
    """
    # Group entities by type
    type_entities: dict[str, list[dict]] = defaultdict(list)

    for record in registry.entries.values():
        if record.ontology_type == OntologyType.UNKNOWN:
            continue
        type_key = record.ontology_type.value
        type_entities[type_key].append({
            "id": record.id,
            "name": record.canonical_name,
            "confidence": record.confidence.value,
            "aliases": record.aliases,
            "source_file": record.source_file,
            "attributes": record.attributes,
        })

    # Build nodes — one per ontology type that has entities
    nodes = []
    for type_key in sorted(type_entities.keys()):
        entities = type_entities[type_key]
        nodes.append({
            "id": type_key,
            "label": TYPE_LABELS.get(type_key, type_key.replace("_", " ").title()),
            "type": "group",
            "color": TYPE_COLORS.get(type_key, "#95A5A6"),
            "entity_count": len(entities),
            "entities": sorted(entities, key=lambda e: e["name"]),
        })

    # Build edges from FK_RULES (only between types that exist in the registry)
    active_types = set(type_entities.keys())
    edges = []
    seen_edges = set()

    for (child, col), parent in FK_RULES.items():
        if child in active_types and parent in active_types:
            edge_key = f"{child}->{parent}"
            if edge_key not in seen_edges:
                edges.append({
                    "source": child,
                    "target": parent,
                    "label": col,
                    "type": "fk",
                })
                seen_edges.add(edge_key)

    # If we have a schema, also infer edges from actual FK definitions
    if schema:
        for table in schema.get("tables", []):
            for fk in table.get("foreign_keys", []):
                child_type = table["table_name"]
                parent_type = fk["references_table"]
                if child_type in active_types and parent_type in active_types:
                    edge_key = f"{child_type}->{parent_type}"
                    if edge_key not in seen_edges:
                        edges.append({
                            "source": child_type,
                            "target": parent_type,
                            "label": fk["column"],
                            "type": "fk",
                        })
                        seen_edges.add(edge_key)

    total_entities = sum(len(e) for e in type_entities.values())

    return {
        "nodes": nodes,
        "edges": edges,
        "stats": {
            "total_entities": total_entities,
            "total_types": len(nodes),
            "total_relationships": len(edges),
        },
        "generated_at": datetime.utcnow().isoformat(),
    }


def generate_and_save(registry_path: Path | None = None) -> dict:
    """
    Full pipeline: load registry + schema → build graph → save JSON.
    Returns the graph dict.
    """
    DATAFLOW_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    registry = load_registry(registry_path)

    # Try to load schema if available
    schema = None
    schema_path = SCHEMA_OUTPUT_DIR / "schema.json"
    if schema_path.exists():
        schema = json.loads(schema_path.read_text())

    graph = build_graph(registry, schema)

    out_path = DATAFLOW_OUTPUT_DIR / "dataflow.json"
    out_path.write_text(json.dumps(graph, indent=2))

    print(f"[DataFlow] Generated graph: {graph['stats']['total_types']} types, "
          f"{graph['stats']['total_entities']} entities, "
          f"{graph['stats']['total_relationships']} relationships")
    print(f"[DataFlow] Saved → {out_path}")

    return graph


if __name__ == "__main__":
    generate_and_save()
