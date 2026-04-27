#!/usr/bin/env bash
# Audible second-brain freshness check — runs at SessionStart.
# Defers to a Python helper for clean JSON I/O.
set -euo pipefail
exec python3 "$(dirname "$0")/check-freshness.py"
