"""
api.py — FastAPI application shell for DataArch.AI.

This is the main entry point. It creates the FastAPI app, configures
middleware, includes all route modules, and serves the frontend.

Route modules:
  routes/auth.py       — Authentication (register, login, API keys)
  routes/ingest.py     — Document ingestion, pipeline automation
  routes/ontology.py   — Ontology mapping and entity registry
  routes/schema.py     — Schema generation
  routes/dataflow.py   — Data flow visualization
  routes/database.py   — Database management
  routes/ai.py         — AI search and analytics
  routes/portfolio.py  — Portfolio companies and intelligence
  routes/entities.py   — Entity resolution (duplicates, merge)
  routes/admin.py      — Admin endpoints (ontology CRUD)
"""

import logging
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

import config

# ── Rate Limiter ───────────────────────────────────────────────────────────
# Key function uses remote IP. In production behind a proxy, swap
# get_remote_address for a function that reads the X-Forwarded-For header.
limiter = Limiter(key_func=get_remote_address)

log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events for the FastAPI app."""
    # ── Startup ────────────────────────────────────────────────────
    # Configure structured logging first (before any log lines)
    from services.logging_config import setup_logging
    setup_logging()

    # Initialize Sentry error monitoring (no-op when SENTRY_DSN is empty)
    if config.SENTRY_DSN:
        import sentry_sdk
        sentry_sdk.init(
            dsn=config.SENTRY_DSN,
            environment=config.DATAARCH_ENV,
            release=f"dataarch@{config.APP_VERSION}",
            traces_sample_rate=config.SENTRY_TRACES_SAMPLE_RATE,
            send_default_pii=False,
        )
        log.info("Sentry error monitoring initialized (env=%s)", config.DATAARCH_ENV)

    log.info("DataArch.AI %s starting up ...", config.APP_VERSION)

    # Warm the ontology cache from DB (or fallback)
    try:
        from services.ontology_service import get_ontology_types
        types = get_ontology_types()
        log.info("Ontology cache warmed: %d active types.", len(types))
    except Exception as e:
        log.warning("Could not warm ontology cache: %s", e)

    yield

    # ── Shutdown ───────────────────────────────────────────────────
    log.info("DataArch.AI shutting down.")

# ── Create application ─────────────────────────────────────────────────────

app = FastAPI(
    title="DataArch.AI API",
    description="Upload business documents. Get structured, AI-ready data back.",
    version=config.APP_VERSION,
    lifespan=lifespan,
)

# Attach limiter to app state so slowapi decorators can find it
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS Middleware ────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Correlation ID Middleware ──────────────────────────────────────────────

@app.middleware("http")
async def correlation_id_middleware(request: Request, call_next):
    """
    Generate or extract correlation_id for each request.

    - Reads X-Correlation-ID header if present, otherwise generates a new UUID4
    - Injects correlation_id, user_id, company_id into logging context
    - Adds X-Correlation-ID response header for request tracing
    """
    from services.logging_config import set_log_context

    # Get or generate correlation ID
    correlation_id = request.headers.get("X-Correlation-ID") or str(uuid.uuid4())

    # Extract user/company context from auth token (if available)
    user_id = None
    company_id = None
    try:
        from auth import get_optional_user
        user = get_optional_user(request)
        if user:
            user_id = user.id
            company_id = user.company_id
    except Exception:
        # Auth not available or failed — continue without user context
        pass

    # Set logging context for this request
    set_log_context(
        correlation_id=correlation_id,
        user_id=user_id,
        company_id=company_id,
    )

    # Enrich Sentry scope with user/request context
    if config.SENTRY_DSN:
        import sentry_sdk
        sentry_sdk.set_tag("correlation_id", correlation_id)
        if user_id:
            sentry_sdk.set_user({"id": user_id, "company_id": company_id})

    # Process request
    response = await call_next(request)

    # Add correlation ID to response headers
    response.headers["X-Correlation-ID"] = correlation_id

    return response

# ── Include Routers ────────────────────────────────────────────────────────

from routes.auth import router as auth_router
from routes.ingest import router as ingest_router
from routes.invites import router as invites_router
from routes.ontology import router as ontology_router
from routes.schema import router as schema_router
from routes.dataflow import router as dataflow_router
from routes.database import router as database_router
from routes.ai import router as ai_router
from routes.portfolio import router as portfolio_router
from routes.entities import router as entities_router
from routes.admin import router as admin_router
from routes.confidence import router as confidence_router

app.include_router(auth_router)
app.include_router(ingest_router)
app.include_router(invites_router)
app.include_router(ontology_router)
app.include_router(schema_router)
app.include_router(dataflow_router)
app.include_router(database_router)
app.include_router(ai_router)
app.include_router(portfolio_router)
app.include_router(entities_router)
app.include_router(admin_router)
app.include_router(confidence_router)

# ── Static Files & Frontend ────────────────────────────────────────────────

FRONTEND_DIR = Path(__file__).parent / "frontend"

app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")


@app.get("/", response_class=HTMLResponse)
def root():
    """Serve the DataArch.AI UI."""
    index_path = FRONTEND_DIR / "index.html"
    if index_path.exists():
        return HTMLResponse(content=index_path.read_text())
    return HTMLResponse(content="<h1>DataArch.AI</h1><p>Frontend not found.</p>")


@app.get("/invite/{token}", response_class=HTMLResponse)
def invite_page(token: str):
    """Serve the invite acceptance SPA page.

    The frontend JS reads the token from the URL path and calls
    GET /invites/accept/{token} to validate and prefill the registration form.
    """
    index_path = FRONTEND_DIR / "index.html"
    if index_path.exists():
        return HTMLResponse(content=index_path.read_text())
    return HTMLResponse(content="<h1>DataArch.AI — Invite</h1><p>Frontend not found.</p>")


@app.get("/health")
def health():
    """Health check endpoint."""
    return {
        "status": "ok",
        "product": config.APP_NAME,
        "version": config.APP_VERSION,
    }


@app.get("/dataflow/view", response_class=HTMLResponse)
def dataflow_view():
    """Serve the data flow visualization page."""
    path = FRONTEND_DIR / "dataflow.html"
    if path.exists():
        return HTMLResponse(content=path.read_text())
    return HTMLResponse(content="<h1>DataArch.AI</h1><p>Data flow visualization not found.</p>")


@app.get("/architecture", response_class=HTMLResponse)
def architecture_view():
    """Serve the system architecture map."""
    path = FRONTEND_DIR / "architecture.html"
    if path.exists():
        return HTMLResponse(content=path.read_text())
    return HTMLResponse(content="<h1>DataArch.AI</h1><p>Architecture page not found.</p>")
