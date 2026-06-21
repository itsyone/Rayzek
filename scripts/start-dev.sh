#!/usr/bin/env bash
# Rayzek — start backend and frontend in development mode (Linux / macOS).
# Usage:  ./scripts/start-dev.sh [--demo]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

DEMO="false"
[[ "${1:-}" == "--demo" ]] && DEMO="true"

echo "Starting Rayzek (dev)…"

# --- Backend ---
if [[ ! -d "$BACKEND/.venv" ]]; then
  echo "Creating backend virtual environment…"
  python3 -m venv "$BACKEND/.venv"
  "$BACKEND/.venv/bin/pip" install --upgrade pip
  "$BACKEND/.venv/bin/pip" install -r "$BACKEND/requirements.txt"
fi

(
  cd "$BACKEND"
  RAYZEK_DEMO_MODE="$DEMO" .venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
) &
BACKEND_PID=$!

# --- Frontend ---
if [[ ! -d "$FRONTEND/node_modules" ]]; then
  echo "Installing frontend dependencies…"
  (cd "$FRONTEND" && npm install)
fi
(cd "$FRONTEND" && npm run dev) &
FRONTEND_PID=$!

echo "Backend:  http://127.0.0.1:8000  (docs at /docs)"
echo "Frontend: http://localhost:5173"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true" EXIT
wait
