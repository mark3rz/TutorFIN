"""
pipeline/ontology/mapper.py — Orchestrates the full ontology mapping pipeline.

Takes a ParsedDocument (or a directory of output JSONs), runs each entity
through the classifier, deduplicates against the entity registry, and writes
output to outputs/ontology/.
"""

import hashlib
import json
import os
from pathlib import Path

import anthropic
from dotenv import load_dotenv

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

load_dotenv()

ONTOLOGY_OUTPUT_DIR = Path("outputs/ontology")
REGISTRY_PATH = ONTOLOGY_OUTPUT_DIR / "entity_registry.json"


def _get_client() -> anthropic.Anthropic:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise EnvironmentError("ANTHROPIC_API_KEY not set.")
    return anthropic.Anthropic(api_key=api_key)


def _make_id(source_file: str, canonical_name: str, ontology_type: str) -> str:
    """Stable hash ID for deduplication."""
    key = f"{canonical_name.lower().strip()}::{ontology_type}"
    return hashlib.sha256(key.encode()).hexdigest()[:16]


def _load_registry() -> EntityRegistry:
    if REGISTRY_PATH.exists():
        data = json.loads(REGISTRY_PATH.read_text())
        return EntityRegistry(**data)
    return EntityRegistry()


def _save_registry(registry: EntityRegistry) -> None:
    REGISTRY_PATH.write_text(json.dumps(registry.to_output_dict(), indent=2))


def map_document(doc: ParsedDocument) -> OntologyResult:
    """
    Map all entities in a ParsedDocument to the PE business ontology.
    Updates the shared entity registry. Returns an OntologyResult.
    """
    ONTOLOGY_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    client = _get_client()
    registry = _load_registry()

    records: list[OntologyRecord] = []
    unmapped = 0

    print(f"[Ontology] Mapping {len(doc.entities)} entities from {doc.metadata.filename}")

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
                id=_make_id(doc.metadata.filename, canonical_name, ont_type.value),
                ontology_type=ont_type,
                confidence=confidence,
                canonical_name=canonical_name,
                aliases=result.get("aliases", []),
                source_file=doc.metadata.filename,
                source_entity_type=entity.entity_type,
                source_attributes=entity.attributes,
                attributes=result.get("attributes", {}),
                mapping_notes=result.get("mapping_notes", ""),
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


def map_from_parsed_json(json_path: str | Path) -> OntologyResult:
    """Load a ParsedDocument from a saved JSON file and map it."""
    data = json.loads(Path(json_path).read_text())
    doc = ParsedDocument(**data)
    return map_document(doc)


def map_all_outputs(outputs_dir: str | Path = "outputs") -> list[OntologyResult]:
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
            results.append(map_from_parsed_json(jf))
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
