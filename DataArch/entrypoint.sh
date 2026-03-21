#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# DataArch.AI — Container Entrypoint
#
# 1. Run Alembic migrations (safe — idempotent)
# 2. Seed ontology defaults (safe — skips if already seeded)
# 3. Start the Uvicorn server
# ──────────────────────────────────────────────────────────────

set -e

echo "DataArch.AI — starting up ..."

# ── 1. Run database migrations ────────────────────────────────
echo "[migrate] Running Alembic migrations ..."
python -m alembic upgrade head
echo "[migrate] Migrations complete."

# ── 2. Seed ontology defaults ────────────────────────────────
echo "[seed] Seeding ontology defaults ..."
python -m seeds.ontology_defaults
echo "[seed] Seeding complete."

# ── 3. Start the server ──────────────────────────────────────
echo "[server] Starting Uvicorn on port 8000 ..."
exec uvicorn api:app --host 0.0.0.0 --port 8000
