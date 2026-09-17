#!/usr/bin/env bash
# 把 shared-rules/ 下的共享规则下发到三个 repo 的 .qoder/rules/（要求三个 repo 是同级目录）
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PARENT="$(dirname "$HERE")"
for repo in qoder-terminal-data qoder-terminal-analyst qoder-terminal-web; do
  target="$PARENT/$repo/.qoder/rules"
  if [ ! -d "$PARENT/$repo" ]; then
    echo "skip $repo（未找到 $PARENT/$repo）"; continue
  fi
  mkdir -p "$target"
  cp "$HERE"/shared-rules/*.md "$target/"
  echo "synced → $repo"
done
