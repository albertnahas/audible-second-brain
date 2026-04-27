#!/usr/bin/env bash
# Launches the books dashboard on a local HTTP server.
# Usage: ./serve.sh [port]
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${1:-8888}"
URL="http://localhost:${PORT}/dashboard.html"
echo "Books dashboard → ${URL}"
# Refresh the scored JSON before launching so latest data loads
if [[ -f "${DIR}/_score.py" ]]; then
  python3 "${DIR}/_score.py"
fi
( sleep 1 && open "${URL}" ) &
exec python3 -m http.server "${PORT}" --directory "${DIR}"
