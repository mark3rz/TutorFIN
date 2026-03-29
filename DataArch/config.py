"""
config.py — Centralized configuration for DataArch.AI.

All settings come from environment variables with sensible defaults.
Import this module instead of reading os.environ directly.

Environment variables:
  DATABASE_URL       — PostgreSQL connection string
  ANTHROPIC_API_KEY  — Claude API key
  DATAARCH_MODEL     — LLM model identifier
  VOYAGE_API_KEY     — Voyage AI API key (for embeddings)
  DATAARCH_ENV       — Environment name (dev/staging/prod)
"""

import os
from dotenv import load_dotenv

load_dotenv()


# ── Database ─────────────────────────────────────────────────────────────────

DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "postgresql://dataarch:dataarch@localhost:5432/dataarch",
)

# Connection pool settings
DB_POOL_SIZE: int = int(os.getenv("DB_POOL_SIZE", "5"))
DB_MAX_OVERFLOW: int = int(os.getenv("DB_MAX_OVERFLOW", "10"))
DB_POOL_TIMEOUT: int = int(os.getenv("DB_POOL_TIMEOUT", "30"))
DB_ECHO: bool = os.getenv("DB_ECHO", "false").lower() in ("true", "1", "yes")

# ── LLM ──────────────────────────────────────────────────────────────────────

ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
DATAARCH_MODEL: str = os.getenv("DATAARCH_MODEL", "claude-sonnet-4-5-20250929")

# ── Embeddings ───────────────────────────────────────────────────────────────

VOYAGE_API_KEY: str = os.getenv("VOYAGE_API_KEY", "")
EMBEDDING_MODEL: str = os.getenv("DATAARCH_EMBEDDING_MODEL", "voyage-3")
EMBEDDING_DIMENSION: int = int(os.getenv("DATAARCH_EMBEDDING_DIM", "1024"))

# ── Application ──────────────────────────────────────────────────────────────

DATAARCH_ENV: str = os.getenv("DATAARCH_ENV", "dev")
APP_VERSION: str = "0.9.3"
APP_NAME: str = "DataArch.AI"

# ── Authentication ──────────────────────────────────────────────────────────

JWT_SECRET: str = os.getenv("JWT_SECRET", "dataarch-dev-secret-change-in-production")
JWT_ALGORITHM: str = "HS256"
JWT_EXPIRY_HOURS: int = int(os.getenv("JWT_EXPIRY_HOURS", "24"))

# ── CORS ────────────────────────────────────────────────────────────────────

CORS_ORIGINS: list[str] = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", "http://localhost:8000,http://127.0.0.1:8000").split(",")
    if o.strip()
]

# ── Entity Resolution (Phase 5) ────────────────────────────────────────────

DEFAULT_SIMILARITY_THRESHOLD: float = float(os.getenv("DATAARCH_SIMILARITY_THRESHOLD", "0.85"))
MAX_MERGE_HISTORY: int = int(os.getenv("DATAARCH_MAX_MERGE_HISTORY", "1000"))

# ── Paths ────────────────────────────────────────────────────────────────────

OUTPUTS_DIR: str = os.getenv("DATAARCH_OUTPUTS_DIR", "outputs")
SCHEMA_OUTPUT_DIR: str = os.path.join(OUTPUTS_DIR, "schema")
ONTOLOGY_OUTPUT_DIR: str = os.path.join(OUTPUTS_DIR, "ontology")
DATAFLOW_OUTPUT_DIR: str = os.path.join(OUTPUTS_DIR, "dataflow")
