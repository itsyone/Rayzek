#!/usr/bin/env bash
# Remove the local SQLite database so it is recreated on next startup.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/backend"
rm -f rayzek.db rayzek.db-wal rayzek.db-shm
echo "Database reset. It will be recreated on next backend start."
