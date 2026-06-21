#!/usr/bin/env bash
# Run backend and frontend test suites.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "== Backend tests =="
(cd "$ROOT/backend" && .venv/bin/python -m pytest -q)

echo "== Frontend tests =="
(cd "$ROOT/frontend" && npm run test)
