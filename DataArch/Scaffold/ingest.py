"""
ingest.py — File router. Detects document type and dispatches to the right parser.
This is the main entry point for the ingestion pipeline.
"""

import json
from pathlib import Path
from pipeline.schema import ParsedDocument, ExtractionStatus
from pipeline.parsers import pdf, excel, docx, email as email_parser

# Extension → parser mapping
PARSERS = {
    ".pdf":  pdf.parse,
    ".xlsx": excel.parse,
    ".xlsm": excel.parse,
    ".csv":  excel.parse,
    ".docx": docx.parse,
    ".doc":  docx.parse,
    ".eml":  email_parser.parse,
}


def ingest(file_path: str | Path) -> ParsedDocument:
    """
    Ingest a single document. Returns a ParsedDocument.
    Saves output JSON to outputs/<filename>.json automatically.
    """
    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")

    suffix = path.suffix.lower()
    parser = PARSERS.get(suffix)

    if parser is None:
        raise ValueError(f"Unsupported file type: {suffix}. Supported: {list(PARSERS.keys())}")

    print(f"[DataArch] Ingesting: {path.name} ({suffix})")
    result = parser(path)
    print(f"[DataArch] Status: {result.status} | Entities: {len(result.entities)}")

    # Save output
    output_dir = Path("outputs")
    output_dir.mkdir(exist_ok=True)
    output_path = output_dir / f"{path.stem}.json"
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
