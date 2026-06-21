#!/usr/bin/env bash
# Format and lint both projects.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "== Backend (ruff) =="
(cd "$ROOT/backend" && .venv/bin/ruff check --fix app tests && .venv/bin/ruff format app tests)

echo "== Frontend (prettier + eslint) =="
(cd "$ROOT/frontend" && npm run format && npm run lint)
