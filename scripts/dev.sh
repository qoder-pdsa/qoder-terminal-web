#!/usr/bin/env bash
# Start data + analyst + web locally in parallel (repos must be sibling directories; Ctrl+C stops everything)
# DATA_PROVIDER=longbridge ./scripts/dev.sh uses live Hong Kong market data
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PARENT="$(dirname "$HERE")"
trap 'kill 0' EXIT

(cd "$PARENT/qoder-terminal-data" && DATA_PROVIDER="${DATA_PROVIDER:-mock}" go run ./cmd/server) &
(cd "$PARENT/qoder-terminal-analyst" && make dev) &
(cd "$HERE" && make dev) &
wait
