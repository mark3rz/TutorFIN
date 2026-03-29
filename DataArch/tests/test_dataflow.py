"""
tests/test_dataflow.py — Unit tests for Layer 4 data flow graph generator.
No API key needed — tests use synthetic EntityRegistry data.
"""

from pipeline.ontology.schema import (
    EntityRegistry, OntologyRecord, OntologyType, MappingConfidence,
)
from pipeline.dataflow import build_graph, _get_type_colors, _get_type_labels

# TYPE_COLORS and TYPE_LABELS are None at module level (DB-backed, lazy-loaded).
# Use the accessor functions directly in tests.
TYPE_COLORS = _get_type_colors()
TYPE_LABELS = _get_type_labels()


def _make_record(
    id: str,
    ont_type: OntologyType,
    name: str,
    attributes: dict | None = None,
    source: str = "test.pdf",
) -> OntologyRecord:
    return OntologyRecord(
        id=id,
        ontology_type=ont_type,
        confidence=MappingConfidence.HIGH,
        canonical_name=name,
        source_file=source,
        source_entity_type="test",
        attributes=attributes or {},
    )


def _build_registry(*records: OntologyRecord) -> EntityRegistry:
    reg = EntityRegistry()
    for r in records:
        reg.upsert(r)
    return reg


# ── build_graph ──────────────────────────────────────────────────────────────

def test_empty_registry_produces_empty_graph():
    graph = build_graph(EntityRegistry())
    assert graph["nodes"] == []
    assert graph["edges"] == []
    assert graph["stats"]["total_entities"] == 0
    assert graph["stats"]["total_types"] == 0
    assert graph["stats"]["total_relationships"] == 0


def test_single_type_produces_one_node():
    registry = _build_registry(
        _make_record("v1", OntologyType.VENDOR, "Acme Corp"),
        _make_record("v2", OntologyType.VENDOR, "Beta Inc"),
    )
    graph = build_graph(registry)

    assert len(graph["nodes"]) == 1
    node = graph["nodes"][0]
    assert node["id"] == "vendor"
    assert node["label"] == "Vendors"
    assert node["entity_count"] == 2
    assert node["color"] == TYPE_COLORS["vendor"]
    assert len(node["entities"]) == 2


def test_multiple_types_produce_multiple_nodes():
    registry = _build_registry(
        _make_record("v1", OntologyType.VENDOR, "Acme"),
        _make_record("c1", OntologyType.CUSTOMER, "Beta"),
        _make_record("e1", OntologyType.EMPLOYEE, "Jane"),
    )
    graph = build_graph(registry)

    assert len(graph["nodes"]) == 3
    assert graph["stats"]["total_entities"] == 3
    assert graph["stats"]["total_types"] == 3
    node_ids = [n["id"] for n in graph["nodes"]]
    assert "vendor" in node_ids
    assert "customer" in node_ids
    assert "employee" in node_ids


def test_unknown_type_excluded():
    registry = _build_registry(
        _make_record("u1", OntologyType.UNKNOWN, "Mystery"),
        _make_record("v1", OntologyType.VENDOR, "Acme"),
    )
    graph = build_graph(registry)

    assert len(graph["nodes"]) == 1
    assert graph["nodes"][0]["id"] == "vendor"
    assert graph["stats"]["total_entities"] == 1


def test_fk_edges_generated():
    """Edges should be created for FK relationships between present types."""
    registry = _build_registry(
        _make_record("v1", OntologyType.VENDOR, "Acme"),
        _make_record("t1", OntologyType.TRANSACTION, "Invoice"),
    )
    graph = build_graph(registry)

    assert len(graph["edges"]) >= 1
    edge = graph["edges"][0]
    assert edge["source"] == "transaction"
    assert edge["target"] == "vendor"
    assert edge["type"] == "fk"


def test_no_edges_for_unrelated_types():
    """Types without FK relationships should not have edges."""
    registry = _build_registry(
        _make_record("v1", OntologyType.VENDOR, "Acme"),
        _make_record("e1", OntologyType.EMPLOYEE, "Jane"),
    )
    graph = build_graph(registry)

    # vendor and employee have no direct FK relationship
    assert len(graph["edges"]) == 0


def test_edges_from_schema_fk():
    """Edges should also be inferred from schema foreign keys."""
    registry = _build_registry(
        _make_record("v1", OntologyType.VENDOR, "Acme"),
        _make_record("c1", OntologyType.CONTRACT, "MSA"),
    )
    schema = {
        "tables": [
            {
                "table_name": "contract",
                "foreign_keys": [
                    {"column": "vendor_id", "references_table": "vendor", "references_column": "id"}
                ],
            }
        ]
    }
    graph = build_graph(registry, schema)

    edge_targets = [(e["source"], e["target"]) for e in graph["edges"]]
    assert ("contract", "vendor") in edge_targets


def test_entities_sorted_by_name():
    registry = _build_registry(
        _make_record("v2", OntologyType.VENDOR, "Zebra Corp"),
        _make_record("v1", OntologyType.VENDOR, "Acme Inc"),
    )
    graph = build_graph(registry)

    entities = graph["nodes"][0]["entities"]
    assert entities[0]["name"] == "Acme Inc"
    assert entities[1]["name"] == "Zebra Corp"


def test_entity_details_included():
    registry = _build_registry(
        _make_record("v1", OntologyType.VENDOR, "Acme", {"vendor_id": "V001"}, "invoice.pdf"),
    )
    graph = build_graph(registry)

    entity = graph["nodes"][0]["entities"][0]
    assert entity["name"] == "Acme"
    assert entity["confidence"] == "high"
    assert entity["source_file"] == "invoice.pdf"
    assert entity["attributes"]["vendor_id"] == "V001"


def test_graph_has_generated_at():
    graph = build_graph(EntityRegistry())
    assert "generated_at" in graph


def test_no_duplicate_edges():
    """Same FK relationship should not produce duplicate edges."""
    registry = _build_registry(
        _make_record("v1", OntologyType.VENDOR, "Acme"),
        _make_record("t1", OntologyType.TRANSACTION, "Invoice"),
    )
    # Schema has same FK as FK_RULES
    schema = {
        "tables": [
            {
                "table_name": "transaction",
                "foreign_keys": [
                    {"column": "vendor_id", "references_table": "vendor", "references_column": "id"}
                ],
            }
        ]
    }
    graph = build_graph(registry, schema)

    tx_to_vendor = [e for e in graph["edges"] if e["source"] == "transaction" and e["target"] == "vendor"]
    assert len(tx_to_vendor) == 1


# ── TYPE_COLORS and TYPE_LABELS ──────────────────────────────────────────────

def test_all_ontology_types_have_colors():
    """Every non-unknown OntologyType should have a color."""
    for t in OntologyType:
        assert t.value in TYPE_COLORS, f"Missing color for {t.value}"


def test_all_ontology_types_have_labels():
    """Every non-unknown OntologyType should have a label."""
    for t in OntologyType:
        if t != OntologyType.UNKNOWN:
            assert t.value in TYPE_LABELS, f"Missing label for {t.value}"
