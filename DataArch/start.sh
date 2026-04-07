#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# DataArch.AI — Start Script
# Installs dependencies, runs tests, and launches the server.
#
# Usage:
#   ./start.sh          Start locally (Python + local/remote PostgreSQL)
#   ./start.sh docker   Start everything via Docker Compose
# ──────────────────────────────────────────────────────────────

set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${CYAN}${BOLD}  DataArch.AI${NC}"
echo -e "${CYAN}  AI Data Operating System for Private Equity${NC}"
echo ""

# ── Docker Mode ─────────────────────────────────────────────
if [ "${1:-}" = "docker" ]; then
    echo -e "${CYAN}[docker]${NC} Starting with Docker Compose..."
    echo ""

    if ! command -v docker &>/dev/null; then
        echo -e "${RED}Error: Docker is not installed.${NC}"
        echo "  Install Docker Desktop from https://www.docker.com/products/docker-desktop/"
        exit 1
    fi

    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            echo -e "${YELLOW}No .env file found. Copying from .env.example...${NC}"
            cp .env.example .env
            echo -e "${YELLOW}  Please edit .env and add your ANTHROPIC_API_KEY${NC}"
            echo ""
        else
            echo -e "${RED}No .env file found. Create one with at least ANTHROPIC_API_KEY.${NC}"
            exit 1
        fi
    fi

    echo -e "${YELLOW}[..]${NC} Building and starting containers..."
    docker compose up --build -d

    echo ""
    echo -e "${GREEN}${BOLD}  DataArch.AI is running!${NC}"
    echo ""
    echo -e "  Demo UI:    ${BOLD}http://localhost:${API_PORT:-8000}${NC}"
    echo -e "  API docs:   ${BOLD}http://localhost:${API_PORT:-8000}/docs${NC}"
    echo -e "  Health:     ${BOLD}http://localhost:${API_PORT:-8000}/health${NC}"
    echo -e "  DB Health:  ${BOLD}http://localhost:${API_PORT:-8000}/database/health${NC}"
    echo ""
    echo -e "  View logs:  ${BOLD}docker compose logs -f api${NC}"
    echo -e "  Stop:       ${BOLD}docker compose down${NC}"
    echo -e "  Reset DB:   ${BOLD}docker compose down -v${NC}"
    echo ""
    exit 0
fi

# ── Local Mode ──────────────────────────────────────────────

# ── 1. Check Python ──────────────────────────────────────────
PYTHON=""
for cmd in python3 python; do
    if command -v "$cmd" &>/dev/null; then
        version=$("$cmd" --version 2>&1 | grep -oE '[0-9]+\.[0-9]+')
        major=$(echo "$version" | cut -d. -f1)
        minor=$(echo "$version" | cut -d. -f2)
        if [ "$major" -ge 3 ] && [ "$minor" -ge 11 ]; then
            PYTHON="$cmd"
            break
        fi
    fi
done

if [ -z "$PYTHON" ]; then
    echo -e "${RED}Error: Python 3.11+ is required.${NC}"
    echo "  Install it from https://www.python.org/downloads/"
    echo ""
    echo -e "  Or use Docker mode: ${BOLD}./start.sh docker${NC}"
    exit 1
fi
echo -e "${GREEN}[ok]${NC} Python: $($PYTHON --version)"

# ── 2. Create virtual environment if needed ──────────────────
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}[..]${NC} Creating virtual environment..."
    $PYTHON -m venv venv
    echo -e "${GREEN}[ok]${NC} Virtual environment created"
fi

# Activate
source venv/bin/activate
echo -e "${GREEN}[ok]${NC} Virtual environment activated"

# ── 3. Install dependencies ──────────────────────────────────
echo -e "${YELLOW}[..]${NC} Installing dependencies..."
pip install -q -r requirements.txt
echo -e "${GREEN}[ok]${NC} Dependencies installed"

# ── 4. Check for API key ─────────────────────────────────────
if [ ! -f ".env" ]; then
    if [ -z "$ANTHROPIC_API_KEY" ]; then
        echo ""
        echo -e "${YELLOW}No .env file found and ANTHROPIC_API_KEY is not set.${NC}"
        echo -e "  The server will start, but document processing requires an API key."
        echo ""
        echo -e "  To fix: copy the example and add your key:"
        echo -e "    ${BOLD}cp .env.example .env${NC}"
        echo -e "    ${BOLD}# Edit .env and set ANTHROPIC_API_KEY${NC}"
        echo ""
    else
        echo -e "${GREEN}[ok]${NC} ANTHROPIC_API_KEY found in environment"
    fi
else
    echo -e "${GREEN}[ok]${NC} .env file found"
fi

# ── 5. Check for database ────────────────────────────────────
if [ -z "$DATABASE_URL" ]; then
    DEFAULT_DB="postgresql://dataarch:dataarch@localhost:5432/dataarch"
    echo -e "${YELLOW}[..] DATABASE_URL not set. Using default: ${DEFAULT_DB}${NC}"
    echo -e "  Database endpoints require a running PostgreSQL instance."
    echo ""
    echo -e "  Quick start options:"
    echo -e "    ${BOLD}./start.sh docker${NC}               # Docker Compose (recommended)"
    echo -e "    ${BOLD}brew install postgresql@16${NC}       # macOS with Homebrew"
    echo ""
else
    echo -e "${GREEN}[ok]${NC} DATABASE_URL configured"
fi

# ── 6. Create output directories ─────────────────────────────
mkdir -p outputs/ontology outputs/schema outputs/dataflow
echo -e "${GREEN}[ok]${NC} Output directories ready"

# ── 7. Run database migrations ──────────────────────────────
echo -e "${YELLOW}[..]${NC} Running database migrations..."
if $PYTHON -m alembic upgrade head 2>&1; then
    echo -e "${GREEN}[ok]${NC} Database migrations up to date"

    # Seed ontology defaults
    echo -e "${YELLOW}[..]${NC} Seeding ontology defaults..."
    if $PYTHON -m seeds.ontology_defaults 2>&1; then
        echo -e "${GREEN}[ok]${NC} Ontology defaults seeded"
    else
        echo -e "${YELLOW}[!!]${NC} Ontology seeding skipped (database may not be available)"
    fi
else
    echo -e "${YELLOW}[!!]${NC} Migration skipped (database may not be available)"
    echo -e "  Migrations will run automatically on first database connection."
fi
echo ""

# ── 8. Run tests ─────────────────────────────────────────────
echo -e "${YELLOW}[..]${NC} Running tests..."
if $PYTHON -m pytest tests/ -q --tb=short 2>&1; then
    echo -e "${GREEN}[ok]${NC} All tests passed"
else
    echo ""
    echo -e "${RED}Some tests failed. The server will still start, but check the errors above.${NC}"
fi

# ── 9. Launch server ─────────────────────────────────────────
PORT="${PORT:-8000}"
echo ""
echo -e "${CYAN}${BOLD}  Starting DataArch.AI server...${NC}"
echo ""
echo -e "  Demo UI:    ${BOLD}http://localhost:${PORT}${NC}"
echo -e "  API docs:   ${BOLD}http://localhost:${PORT}/docs${NC}"
echo -e "  Health:     ${BOLD}http://localhost:${PORT}/health${NC}"
echo -e "  DB Health:  ${BOLD}http://localhost:${PORT}/database/health${NC}"
echo -e "  Pipeline:   ${BOLD}POST http://localhost:${PORT}/pipeline/run${NC}"
echo ""
echo -e "  Press ${BOLD}Ctrl+C${NC} to stop."
echo ""

exec uvicorn api:app --reload --host 0.0.0.0 --port "$PORT"
