# DataArch.AI — Ingestion Pipeline

> AI-powered document ingestion for private equity & mid-market companies.

## What this does

Drop in a PDF, Excel, DOCX, CSV, or .eml file.  
Get back structured JSON: entities, data fields, a plain-English summary.  
Everything downstream (ontology mapper, schema generator, data flow map) consumes this output.

---

## Setup

### 1. Clone / navigate to this directory
```bash
cd dataarch
```

### 2. Create a virtual environment
```bash
python -m venv venv
source venv/bin/activate        # Mac / Linux
venv\Scripts\activate           # Windows
```

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Add your Anthropic API key
```bash
cp .env.example .env
# Open .env and paste your key:
# ANTHROPIC_API_KEY=sk-ant-...
```
Get a key at https://console.anthropic.com

---

## Usage

### Run the API server
```bash
uvicorn api:app --reload
```
Then open http://localhost:8000/docs for the interactive Swagger UI.

### Upload a document via API
```bash
curl -X POST http://localhost:8000/ingest \
  -F "file=@documents/your_invoice.pdf"
```

### Run the pipeline directly from the command line
```bash
# Single file
python -m pipeline.ingest documents/your_invoice.pdf

# Entire folder
python -m pipeline.ingest documents/
```

Results are saved to `outputs/<filename>.json`.

---

## Supported file types

| Type | Extensions |
|------|-----------|
| PDF | `.pdf` |
| Excel | `.xlsx`, `.xlsm`, `.csv` |
| Word | `.docx`, `.doc` |
| Email | `.eml` |

---

## Project structure

```
dataarch/
├── documents/          ← Drop files here
├── outputs/            ← Parsed JSON results
├── pipeline/
│   ├── ingest.py       ← File router (main entry point)
│   ├── llm.py          ← Claude API wrapper
│   ├── schema.py       ← Pydantic data models
│   └── parsers/
│       ├── pdf.py
│       ├── excel.py
│       ├── docx.py
│       └── email.py
├── api.py              ← FastAPI server
├── requirements.txt
└── .env                ← Your API key (never commit this)
```

---

## Next steps (roadmap)

- [ ] Business ontology mapper (map entities to standard PE business objects)
- [ ] Normalized schema generator (produce SQL DDL from extracted entities)
- [ ] Visual data flow map (frontend graph visualization)
- [ ] Batch ingestion with job queue (Celery / Redis)
- [ ] Multi-tenant support with org isolation
