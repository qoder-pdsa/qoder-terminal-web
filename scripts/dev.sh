#!/usr/bin/env bash
# 本地并行启动 data + analyst + web（要求三个 repo 是同级目录；Ctrl+C 全部退出）
# DATA_PROVIDER=longbridge ./scripts/dev.sh 使用真实港股行情
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PARENT="$(dirname "$HERE")"
trap 'kill 0' EXIT

(cd "$PARENT/qoder-terminal-data" && DATA_PROVIDER="${DATA_PROVIDER:-mock}" go run ./cmd/server) &
(cd "$PARENT/qoder-terminal-analyst" && make dev) &
(cd "$HERE" && make dev) &
wait
