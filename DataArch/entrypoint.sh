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

# ── 3. Seed default admin user ───────────────────────────────
echo "[seed] Checking for default admin user ..."
python -c "
from pipeline.database import get_engine
from auth import hash_password
from sqlalchemy import text
engine = get_engine()
with engine.connect() as conn:
    count = conn.execute(text('SELECT COUNT(*) FROM users')).scalar()
    if count == 0:
        conn.execute(text('''
            INSERT INTO users (email, password_hash, full_name, role, is_active, created_at, updated_at)
            VALUES (:email, :pw, :name, :role, true, NOW(), NOW())
        '''), {'email': 'admin@dataarch.ai', 'pw': hash_password('changeme123'), 'name': 'PE Admin', 'role': 'pe_admin'})
        conn.commit()
        print('SEEDED default admin: admin@dataarch.ai / changeme123 — CHANGE THIS PASSWORD')
    else:
        print(f'Users exist ({count}), skipping seed.')
"
echo "[seed] Admin user check complete."

# ── 4. Start the server ──────────────────────────────────────
echo "[server] Starting Uvicorn on port 8000 ..."
exec uvicorn api:app --host 0.0.0.0 --port 8000
