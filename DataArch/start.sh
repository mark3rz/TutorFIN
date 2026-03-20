#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# DataArch.AI — Start Script
# Installs dependencies, runs tests, and launches the server.
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
        echo -e "  To fix: create a .env file with your key:"
        echo -e "    ${BOLD}echo 'ANTHROPIC_API_KEY=sk-ant-...' > .env${NC}"
        echo ""
    else
        echo -e "${GREEN}[ok]${NC} ANTHROPIC_API_KEY found in environment"
    fi
else
    echo -e "${GREEN}[ok]${NC} .env file found"
fi

# ── 5. Create output directories ─────────────────────────────
mkdir -p outputs/ontology outputs/schema outputs/dataflow
echo -e "${GREEN}[ok]${NC} Output directories ready"

# ── 6. Run tests ─────────────────────────────────────────────
echo ""
echo -e "${YELLOW}[..]${NC} Running tests..."
if $PYTHON -m pytest tests/ -q --tb=short 2>&1; then
    echo -e "${GREEN}[ok]${NC} All tests passed"
else
    echo ""
    echo -e "${RED}Some tests failed. The server will still start, but check the errors above.${NC}"
fi

# ── 7. Launch server ─────────────────────────────────────────
PORT="${PORT:-8000}"
echo ""
echo -e "${CYAN}${BOLD}  Starting DataArch.AI server...${NC}"
echo ""
echo -e "  Demo UI:    ${BOLD}http://localhost:${PORT}${NC}"
echo -e "  API docs:   ${BOLD}http://localhost:${PORT}/docs${NC}"
echo -e "  Health:     ${BOLD}http://localhost:${PORT}/health${NC}"
echo ""
echo -e "  Press ${BOLD}Ctrl+C${NC} to stop."
echo ""

exec uvicorn api:app --reload --host 0.0.0.0 --port "$PORT"
