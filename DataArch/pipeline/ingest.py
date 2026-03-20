"""
ingest.py — File router. Detects document type and dispatches to the right parser.
This is the main entry point for the ingestion pipeline.

Phase 1 fixes:
  - Removed .doc from PARSERS (python-docx can't read legacy .doc format)
  - Output naming includes file hash to prevent collisions
"""

import hashlib
import json
from pathlib import Path
from pipeline.schema import ParsedDocument, ExtractionStatus
from pipeline.parsers import pdf, excel, docx, email as email_parser

# Extension → parser mapping
# NOTE: .doc is NOT supported — python-docx can only read .docx (Open XML format).
#       Legacy .doc files must be converted to .docx first.
PARSERS = {
    ".pdf":  pdf.parse,
    ".xlsx": excel.parse,
    ".xlsm": excel.parse,
    ".csv":  excel.parse,
    ".docx": docx.parse,
    ".eml":  email_parser.parse,
}


def _file_hash(path: Path, length: int = 8) -> str:
    """Compute a short hash of the file for collision-free output naming."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()[:length]


def _output_name(path: Path) -> str:
    """
    Generate a collision-free output filename.
    Format: <stem>_<hash>.json

    This prevents collisions when two files have the same name but different
    content (e.g., invoice.pdf from two different folders).
    """
    file_hash = _file_hash(path)
    return f"{path.stem}_{file_hash}"


def ingest(file_path: str | Path) -> ParsedDocument:
    """
    Ingest a single document. Returns a ParsedDocument.
    Saves output JSON to outputs/<stem>_<hash>.json automatically.
    """
    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")

    suffix = path.suffix.lower()
    parser = PARSERS.get(suffix)

    if parser is None:
        supported = sorted(PARSERS.keys())
        msg = f"Unsupported file type: {suffix}. Supported: {supported}"
        if suffix == ".doc":
            msg += "\nNote: Legacy .doc files are not supported. Convert to .docx first."
        raise ValueError(msg)

    print(f"[DataArch] Ingesting: {path.name} ({suffix})")
    result = parser(path)
    print(f"[DataArch] Status: {result.status} | Entities: {len(result.entities)}")

    # Save output with hash-based naming
    output_dir = Path("outputs")
    output_dir.mkdir(exist_ok=True)
    output_name = _output_name(path)
    output_path = output_dir / f"{output_name}.json"
    output_path.write_text(json.dumps(result.to_output_dict(), indent=2))
    print(f"[DataArch] Saved → {output_path}")

    return result


def ingest_directory(dir_path: str | Path) -> list[ParsedDocument]:
    """Ingest all supported documents in a directory."""
    dir_path = Path(dir_path)
    results = []
    for file in sorted(dir_path.iterdir()):
        if file.suffix.lower() in PARSERS:
            try:
                results.append(ingest(file))
            except Exception as e:
                print(f"[DataArch] ERROR on {file.name}: {e}")
    return results


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python -m pipeline.ingest <file_or_directory>")
        sys.exit(1)

    target = Path(sys.argv[1])
    if target.is_dir():
        ingest_directory(target)
    else:
        ingest(target)
