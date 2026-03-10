#!/bin/bash
# Start both TutorQuant backend and frontend with a single command.
# Usage: ./start.sh
# Press Ctrl+C to stop both.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Starting TutorQuant..."
echo "  Backend  → http://localhost:8000"
echo "  Frontend → http://localhost:3000"
echo ""

# Start backend in background
cd "$SCRIPT_DIR/backend"
python3 -m uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!

# Start frontend in background
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

# Trap Ctrl+C to kill both
cleanup() {
  echo ""
  echo "Shutting down..."
  kill $BACKEND_PID 2>/dev/null
  kill $FRONTEND_PID 2>/dev/null
  wait
  echo "Done."
}
trap cleanup INT TERM

# Wait for either to exit
wait
