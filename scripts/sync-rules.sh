#!/usr/bin/env bash
# Distribute the shared rules in shared-rules/ to .qoder/rules/ of all four repos (the repos must be sibling directories)
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PARENT="$(dirname "$HERE")"
for repo in qoder-terminal-data qoder-terminal-analyst qoder-terminal-user qoder-terminal-web; do
  target="$PARENT/$repo/.qoder/rules"
  if [ ! -d "$PARENT/$repo" ]; then
    echo "skip $repo ($PARENT/$repo not found)"; continue
  fi
  mkdir -p "$target"
  cp "$HERE"/shared-rules/*.md "$target/"
  echo "synced → $repo"
done
