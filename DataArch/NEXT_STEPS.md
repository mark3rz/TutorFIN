# DataArch.AI — Next Steps Plan
> Generated: 2026-03-29 | Based on: TRACKER.md + v0.8.0 codebase analysis
> Current Branch: `DataArch_Dev` | Current Version: v0.8.0 "Foundation"

---

## Where We Are

v0.8.0 shipped the foundational layer:
- ✅ Full 6-stage AI pipeline (parse → extract → classify → schema → load → embed)
- ✅ JWT auth + RBAC (3 roles) — **but auth UI is disabled in frontend**
- ✅ DB-backed ontology with admin API + cache
- ✅ Multi-company portfolio support
- ✅ Semantic search + NL-to-SQL working
- ✅ Docker Compose containerization

**Note:** TRACKER.md still shows v0.7.0 — needs updating to reflect what v0.8.0 actually delivered.

---

## Uncommitted Changes (Staged, Needs Commit)

Before starting new work, commit the current changes on `DataArch_Dev`:

| File | Change |
|------|--------|
| `.gitignore` | 1 line added |
| `DataArch/api.py` | Architecture page route added |
| `DataArch/frontend/index.html` | Minor UI tweaks |
| `DataArch/frontend/architecture.html` | New file — not yet tracked |

```bash
git add DataArch/api.py DataArch/frontend/index.html DataArch/frontend/architecture.html .gitignore
git commit -m "v0.8.0 docs: add architecture page and route"
```

---

## P0 Gaps — Must Fix Before Paying Customers

These are blocking issues from the original P0 checklist that v0.8.0 did NOT fully deliver.

### 1. Re-Enable Auth UI in Frontend ⚠️ HIGH PRIORITY
**File:** `DataArch/frontend/index.html` ~line 462

Auth is built and working on the backend. The frontend has the login/register screens built but they are hidden with a comment: `// AUTH TEMPORARILY DISABLED — skip login screen, go straight to app`.

**Action:** Remove the bypass, wire up the login screen to the `/auth/login` and `/auth/register` endpoints, and store the JWT in `localStorage`.

**Effort:** ~2–3 hours

---

### 2. Rate Limiting on LLM Endpoints
**Files:** `DataArch/routes/ai.py`, `DataArch/api.py`

The `/ai/ask` and `/ai/search` endpoints have no rate limits. A single user could trigger thousands of Claude API calls.

**Action:** Add `slowapi` or a simple in-memory rate limiter. Suggested limits: 30 req/min per user on `/ai/ask`, 60 req/min on `/ai/search`.

**Effort:** ~1–2 hours

---

### 3. Async LLM Calls
**Files:** `DataArch/pipeline/llm.py`, `DataArch/pipeline/embeddings.py`, `DataArch/pipeline/ai_analyst.py`

All LLM calls are synchronous, blocking the FastAPI event loop. This is a performance and reliability issue under concurrent load.

**Action:** Switch to `anthropic.AsyncAnthropic` and `await` calls. Use `run_in_executor()` as fallback for Voyage AI (no async client available).

**Effort:** ~3–4 hours

---

### 4. Persistent Job Store
**File:** `DataArch/pipeline/pipeline_runner.py`

Pipeline job status is stored in a Python `dict` in memory. Server restarts lose all in-flight job state.

**Action:** Add a `pipeline_jobs` table to the Alembic schema and write/read job status from the DB instead of the in-memory dict.

**Effort:** ~3–4 hours (includes Alembic migration)

---

### 5. Update TRACKER.md to Reflect v0.8.0 Reality
Many items marked `[ ]` in the tracker were actually shipped in v0.8.0. Update the tracker to mark them `[x]` so future planning is accurate.

**Items to mark complete:** Auth system, RBAC, tenant isolation, API key management, CORS, file upload limits, input sanitization, audit logging, database migrations, security hardening on `/database/reset` and `/database/query`.

**Effort:** ~30 minutes

---

## v0.9.0 — "Excel Intelligence" (Next Major Release)

Excel is the primary data source for most PE portfolio companies (Tier 3). The current Excel parser treats every sheet as flat text — this loses all structural information.

### Priority Order for v0.9.0

#### Step 1: Smart Sheet Analysis (backend)
**File to create:** `DataArch/pipeline/parsers/excel_intelligence.py`

Build a pre-processing layer that runs before sending content to Claude:

```
1. Sheet-level classification
   - Classify each sheet: financial_statement | headcount_roster | vendor_list |
     revenue_model | cap_table | budget | contract_summary | other
   - Use: openpyxl cell formats, column headers, data patterns

2. Header row detection
   - Find actual header row (not always row 1)
   - Heuristic: first row where >50% cells are non-empty strings, consistent formatting

3. Data type inference per column
   - Read openpyxl number format codes (.number_format attribute)
   - Map: '#,##0.00' → currency | '0.00%' → percentage | 'MM/DD/YYYY' → date

4. Merged cell unmerging
   - openpyxl .merged_cells.ranges → fill down/right

5. Empty row/column stripping
   - Remove rows/columns where >80% of cells are empty
```

#### Step 2: Structure-Aware Extraction (backend)
**File to modify:** `DataArch/pipeline/parsers/excel_parser.py`

Replace flat-text concatenation with structured table extraction:
- For classified sheets: pass as a proper table (headers + rows as JSON) to Claude, not raw text
- For each row in a vendor_list sheet, extract one entity instead of one blob per sheet
- For formula cells: use `openpyxl` without `data_only=True` on a second pass to extract formula strings

**This is the highest-leverage change** — it will dramatically improve extraction quality for Excel files.

#### Step 3: Sheet Preview + Mapping UI (frontend)
**File to modify:** `DataArch/frontend/index.html`

Add a two-step upload flow for `.xlsx` files:
1. Upload → backend returns sheet analysis (headers, classification, preview rows)
2. User reviews: confirm sheet→entity type mappings, select which sheets to process
3. User submits confirmed mappings → pipeline runs with the mapping context

**New API endpoint needed:** `POST /ingest/excel/analyze` → returns sheet structure without running the full pipeline.

#### Step 4: Excel Template Generation
**File to create:** `DataArch/pipeline/excel_templates.py`

Generate downloadable `.xlsx` templates pre-structured for each entity type. PE firms can send these to portfolio companies to fill out, eliminating ambiguity on upload.

---

## v0.10.0 — "Bring Your Own Database" (Major Feature)

This is the strategic unlock that transforms DataArch.AI from a document extraction tool into a portfolio data normalization platform. Tier 1–2 portfolio companies (established companies with real databases) currently cannot use the product.

### Implementation Plan

#### Phase A: Database Connection Manager
**New file:** `DataArch/pipeline/db_connector/connector.py`
**New route file:** `DataArch/routes/connectors.py`

```
- Secure credential storage (encrypted at rest using Fernet symmetric encryption)
- Support: PostgreSQL, MySQL, SQL Server, SQLite (cover 95%+ of portfolio companies)
- Read-only connection enforcement (connect as a read-only user, reject write queries)
- Schema introspection: tables, columns, types, PKs, FKs, row counts, sample rows (first 5)
- Connection health check endpoint
```

#### Phase B: AI Schema Analysis
**New file:** `DataArch/pipeline/db_connector/schema_analyzer.py`

Send introspected schema to Claude with the prompt pattern:
- Input: table names, column names, data types, FK relationships, sample rows
- Output: for each table → recommended ontology type mapping, canonical_name column, attribute column mappings, confidence scores
- Tables that don't map → flagged as "potential new types" → feeds into AI-recommended ontology review queue

#### Phase C: Mapping Review UI
**Files to modify:** `DataArch/frontend/index.html`

New "Database Sources" tab in the frontend:
- Left panel: source schema (tables + columns)
- Right panel: target ontology types
- AI suggestions pre-populated, user can confirm/override/skip
- Persist mappings to DB for reuse on future syncs

#### Phase D: Data Sync Pipeline
**New file:** `DataArch/pipeline/db_connector/sync.py`

```
Initial sync:
- Apply confirmed column mappings
- Transform source rows into DataArch entity format
- Run through existing entity_resolution.py for dedup
- Preserve source_db_id attribute for traceability

Incremental sync:
- Compare updated_at timestamps (primary strategy)
- Row count + checksum comparison (fallback)
- Record sync audit log in DB

Conflict resolution rule (default: DB wins over document extraction)
```

---

## Technical Debt to Resolve (High Severity Only)

These are in `TRACKER.md` under Technical Debt and should be fixed during v0.9.0 or earlier.

### 1. FK References Wrong Column
**Files:** `DataArch/pipeline/schema_generator.py`, `DataArch/pipeline/database.py`

Foreign keys reference `canonical_name` (VARCHAR) instead of `id` (BIGSERIAL). This breaks referential integrity and causes silent data issues.

**Fix:** Update FK definitions to reference the `id` column, not the name.

### 2. Embedding Search Wrong `input_type`
**File:** `DataArch/pipeline/ai_search.py`

Voyage AI requires `input_type="query"` for search queries and `input_type="document"` for indexed documents. Using the wrong type reduces search quality.

**Fix:** One-line change in the search function call.

### 3. Duplicate `_get_client()` Functions
**Files:** `DataArch/pipeline/llm.py`, `DataArch/pipeline/ontology/mapper.py`

Two copies of the same Anthropic client factory. When one changes, the other doesn't.

**Fix:** Move to a shared `DataArch/pipeline/client.py` module and import from both.

### 4. `llm.py` Reads Env Var Directly
**File:** `DataArch/pipeline/llm.py`

Reads `os.environ["ANTHROPIC_API_KEY"]` directly instead of importing from `config.py`.

**Fix:** `from config import settings; settings.anthropic_api_key`

---

## Recommended Build Sequence

```
Phase 1 — Stabilize v0.8.0 (this week)
├── Commit current uncommitted changes
├── Re-enable auth UI in frontend
├── Fix embedding search input_type bug
├── Fix duplicate _get_client() functions
├── Add rate limiting on AI endpoints
└── Update TRACKER.md to reflect actual v0.8.0 state

Phase 2 — v0.9.0 Excel Intelligence (2–3 weeks)
├── Build excel_intelligence.py (sheet analysis layer)
├── Upgrade excel_parser.py to structure-aware extraction
├── Add /ingest/excel/analyze endpoint
├── Add sheet preview + mapping UI in frontend
├── Fix FK reference bug (high severity debt)
└── Add persistent job store (Alembic migration + DB write)

Phase 3 — v0.9.5 Pre-GTM Hardening
├── Async LLM calls
├── Portfolio command center dashboard (P2)
├── Data quality confidence dashboard (P2)
├── Onboarding wizard for new portfolio companies (P2)
└── Export to Excel/PDF

Phase 4 — v0.10.0 Bring Your Own Database
├── DB connector + credential manager
├── Schema introspection engine
├── AI schema analysis + ontology mapping
├── Mapping review UI
├── Initial sync pipeline
└── Incremental sync + conflict resolution

Phase 5 — v1.0.0 Portfolio Ready (GTM)
├── Cross-portfolio NL queries
├── SSO (Okta/Azure AD)
├── Full audit logging
├── Connection wizard in onboarding
└── Sync status dashboard
```

---

## Quick Wins (Can Ship in < 1 Day Each)

1. **Fix embedding search `input_type`** — one line, immediate search quality improvement
2. **Dedup `_get_client()`** — 15 minutes, reduces future bugs
3. **Update TRACKER.md** — mark v0.8.0 items complete, 30 minutes
4. **Add rate limiting** — `pip install slowapi`, add 2 decorators, ~1 hour
5. **Re-enable auth UI** — remove the bypass block, wire up JWT storage, ~2–3 hours

---

## Open Questions Before v0.9.0

1. **Auth UI priority:** Should auth be re-enabled before working on Excel Intelligence, or is it acceptable to ship v0.9.0 with auth still bypassed since it's a single-user dev environment?

2. **Task queue:** Celery + Redis adds significant operational complexity. Given we're pre-revenue, is the thread-based approach acceptable for v0.9.0 as long as we add the persistent job store?

3. **Excel template format:** Should templates be generated based on the default ontology only, or should they be dynamically generated per-fund after the PE firm configures their custom ontology?

4. **DB connector credentials:** Store encrypted in Postgres or use a dedicated secrets manager (HashiCorp Vault, AWS Secrets Manager)? Vault adds infra complexity but is more secure.
