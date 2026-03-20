"""
tests/test_ontology.py — Unit tests for ontology schema (no API key needed).
"""

from pipeline.ontology.schema import (
    OntologyRecord, OntologyResult, EntityRegistry,
    OntologyType, MappingConfidence
)
from pipeline.ontology.classifier import ontology_type_from_str, confidence_from_str
from datetime import datetime


def make_record(name="Acme Corp", ont_type=OntologyType.VENDOR, source="invoice.pdf"):
    return OntologyRecord(
        id=f"test_{name.replace(' ', '_').lower()}",
        ontology_type=ont_type,
        confidence=MappingConfidence.HIGH,
        canonical_name=name,
        source_file=source,
        source_entity_type="vendor",
    )


def test_ontology_type_from_str():
    assert ontology_type_from_str("vendor") == OntologyType.VENDOR
    assert ontology_type_from_str("CUSTOMER") == OntologyType.CUSTOMER
    assert ontology_type_from_str("garbage") == OntologyType.UNKNOWN


def test_confidence_from_str():
    assert confidence_from_str("high") == MappingConfidence.HIGH
    assert confidence_from_str("Medium") == MappingConfidence.MEDIUM
    assert confidence_from_str("unknown") == MappingConfidence.LOW


def test_registry_upsert_new():
    registry = EntityRegistry()
    record = make_record()
    registry.upsert(record)
    assert len(registry.entries) == 1
    assert "test_acme_corp" in registry.entries


def test_registry_upsert_merge_aliases():
    registry = EntityRegistry()
    r1 = make_record("Acme Corp")
    r1.aliases = ["ACME"]
    registry.upsert(r1)

    r2 = make_record("Acme Corp")
    r2.aliases = ["Acme Corporation"]
    registry.upsert(r2)

    assert len(registry.entries) == 1
    entry = registry.entries["test_acme_corp"]
    assert "ACME" in entry.aliases
    assert "Acme Corporation" in entry.aliases


def test_registry_two_distinct_entities():
    registry = EntityRegistry()
    registry.upsert(make_record("Acme Corp", OntologyType.VENDOR))
    registry.upsert(make_record("Beta LLC", OntologyType.CUSTOMER))
    assert len(registry.entries) == 2


def test_ontology_result_serialization():
    records = [make_record("Acme Corp"), make_record("Jane Doe", OntologyType.EMPLOYEE)]
    result = OntologyResult(source_file="invoice.pdf", records=records, unmapped_count=0)
    d = result.to_output_dict()
    assert d["source_file"] == "invoice.pdf"
    assert len(d["records"]) == 2
    assert d["records"][0]["ontology_type"] == "vendor"
