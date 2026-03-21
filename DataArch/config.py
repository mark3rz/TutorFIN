"""
config.py — Centralized configuration for DataArch.AI.

All settings come from environment variables with sensible defaults.
Import this module instead of reading os.environ directly.

Environment variables:
  DATABASE_URL       — PostgreSQL connection string
  ANTHROPIC_API_KEY  — Claude API key
  DATAARCH_MODEL     — LLM model identifier
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

# ── Application ──────────────────────────────────────────────────────────────

DATAARCH_ENV: str = os.getenv("DATAARCH_ENV", "dev")
APP_VERSION: str = "0.4.0"
APP_NAME: str = "DataArch.AI"

# ── Paths ────────────────────────────────────────────────────────────────────

OUTPUTS_DIR: str = os.getenv("DATAARCH_OUTPUTS_DIR", "outputs")
SCHEMA_OUTPUT_DIR: str = os.path.join(OUTPUTS_DIR, "schema")
ONTOLOGY_OUTPUT_DIR: str = os.path.join(OUTPUTS_DIR, "ontology")
DATAFLOW_OUTPUT_DIR: str = os.path.join(OUTPUTS_DIR, "dataflow")
