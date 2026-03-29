"""
pipeline/ontology/mapper.py — Orchestrates the full ontology mapping pipeline.

Takes a ParsedDocument (or a directory of output JSONs), runs each entity
through the classifier, deduplicates against the entity registry, and writes
output to outputs/ontology/.
"""

import hashlib
import json
from pathlib import Path

from pipeline.client import get_anthropic_client
from pipeline.schema import ParsedDocument
from pipeline.ontology.schema import (
    OntologyRecord,
    OntologyResult,
    EntityRegistry,
)
from pipeline.ontology.classifier import (
    classify_entity,
    confidence_from_str,
    ontology_type_from_str,
)

ONTOLOGY_OUTPUT_DIR = Path("outputs/ontology")
REGISTRY_PATH = ONTOLOGY_OUTPUT_DIR / "entity_registry.json"


def _make_id(
    source_file: str,
    canonical_name: str,
    ontology_type: str,
    company_slug: str | None = None,
) -> str:
    """
    Stable hash ID for deduplication.

    Phase 5: includes company_slug so the same entity name under different
    companies produces different IDs (e.g. 'Acme::vendor::acme-corp' ≠
    'Acme::vendor::beta-holdings').
    """
    key = f"{canonical_name.lower().strip()}::{ontology_type}"
    if company_slug:
        key = f"{key}::{company_slug}"
    return hashlib.sha256(key.encode()).hexdigest()[:16]


def _load_registry() -> EntityRegistry:
    if REGISTRY_PATH.exists():
        data = json.loads(REGISTRY_PATH.read_text())
        return EntityRegistry(**data)
    return EntityRegistry()


def _save_registry(registry: EntityRegistry) -> None:
    REGISTRY_PATH.write_text(json.dumps(registry.to_output_dict(), indent=2))


def map_document(
    doc: ParsedDocument,
    company_slug: str | None = None,
) -> OntologyResult:
    """
    Map all entities in a ParsedDocument to the PE business ontology.
    Updates the shared entity registry. Returns an OntologyResult.

    Args:
        doc: The parsed document containing extracted entities
        company_slug: Portfolio company slug for multi-company isolation (Phase 5)
    """
    ONTOLOGY_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    client = get_anthropic_client()
    registry = _load_registry()

    records: list[OntologyRecord] = []
    unmapped = 0

    company_label = f" [{company_slug}]" if company_slug else ""
    print(f"[Ontology] Mapping {len(doc.entities)} entities from {doc.metadata.filename}{company_label}")

    for entity in doc.entities:
        try:
            result = classify_entity(
                entity_type=entity.entity_type,
                entity_name=entity.name,
                entity_attributes=entity.attributes,
                llm_client=client,
            )

            ont_type = ontology_type_from_str(result.get("ontology_type", "unknown"))
            confidence = confidence_from_str(result.get("confidence", "low"))
            canonical_name = result.get("canonical_name") or entity.name or "unnamed"

            record = OntologyRecord(
                id=_make_id(doc.metadata.filename, canonical_name, ont_type.value,
                            company_slug=company_slug),
                ontology_type=ont_type,
                confidence=confidence,
                canonical_name=canonical_name,
                aliases=result.get("aliases", []),
                source_file=doc.metadata.filename,
                source_entity_type=entity.entity_type,
                source_attributes=entity.attributes,
                attributes=result.get("attributes", {}),
                mapping_notes=result.get("mapping_notes", ""),
                company_slug=company_slug,
            )

            records.append(record)
            registry.upsert(record)

            status = "✓" if ont_type != "unknown" else "?"
            print(f"  {status} {entity.name or '(unnamed)'} → {ont_type.value} [{confidence.value}]")

        except Exception as e:
            unmapped += 1
            print(f"  ✗ Failed to map entity '{entity.name}': {e}")

    result_obj = OntologyResult(
        source_file=doc.metadata.filename,
        records=records,
        unmapped_count=unmapped,
        company_slug=company_slug,
    )

    # Save per-document ontology output
    stem = Path(doc.metadata.filename).stem
    out_path = ONTOLOGY_OUTPUT_DIR / f"{stem}_ontology.json"
    out_path.write_text(json.dumps(result_obj.to_output_dict(), indent=2))
    print(f"[Ontology] Saved → {out_path}")

    # Save updated registry
    _save_registry(registry)
    print(f"[Ontology] Registry: {len(registry.entries)} unique entities")

    return result_obj


def map_from_parsed_json(
    json_path: str | Path,
    company_slug: str | None = None,
) -> OntologyResult:
    """Load a ParsedDocument from a saved JSON file and map it."""
    data = json.loads(Path(json_path).read_text())
    doc = ParsedDocument(**data)
    return map_document(doc, company_slug=company_slug)


def map_all_outputs(
    outputs_dir: str | Path = "outputs",
    company_slug: str | None = None,
) -> list[OntologyResult]:
    """Map every ParsedDocument JSON in the outputs directory."""
    outputs_dir = Path(outputs_dir)
    results = []
    json_files = [
        f for f in sorted(outputs_dir.glob("*.json"))
        if not f.parent.name == "ontology"
    ]
    print(f"[Ontology] Found {len(json_files)} parsed documents to map")
    for jf in json_files:
        try:
            results.append(map_from_parsed_json(jf, company_slug=company_slug))
        except Exception as e:
            print(f"[Ontology] ERROR on {jf.name}: {e}")
    return results


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python -m pipeline.ontology.mapper <parsed_output.json | outputs_dir>")
        sys.exit(1)

    target = Path(sys.argv[1])
    if target.is_dir():
        map_all_outputs(target)
    else:
        map_from_parsed_json(target)
