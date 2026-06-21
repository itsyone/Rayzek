#!/usr/bin/env bash
# Launch Rayzek in Demo Mode (synthetic data, no real connections read).
exec "$(dirname "${BASH_SOURCE[0]}")/start-dev.sh" --demo
