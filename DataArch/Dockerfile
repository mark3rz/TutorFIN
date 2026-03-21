# ──────────────────────────────────────────────────────────────
# DataArch.AI — Production Dockerfile
# Multi-stage build for a lean Python API container.
# ──────────────────────────────────────────────────────────────

FROM python:3.13-slim AS base

# Prevent Python from buffering stdout/stderr
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# ── Install system dependencies ──────────────────────────────
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libpq-dev \
        gcc \
    && rm -rf /var/lib/apt/lists/*

# ── Install Python dependencies ──────────────────────────────
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Copy application code ────────────────────────────────────
COPY . .

# ── Create output directories ────────────────────────────────
RUN mkdir -p outputs/ontology outputs/schema outputs/dataflow

# ── Expose port ──────────────────────────────────────────────
EXPOSE 8000

# ── Health check ─────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# ── Entrypoint: run migrations, seed, then start server ─────
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

CMD ["./entrypoint.sh"]
