#!/usr/bin/env bash
# Run lint + tests for all four repos in turn and summarize the results
set -uo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PARENT="$(dirname "$HERE")"
failed=()
for repo in qoder-terminal-data qoder-terminal-analyst qoder-terminal-user qoder-terminal-web; do
  echo "==> $repo"
  (cd "$PARENT/$repo" && make lint test) || failed+=("$repo")
done
if [ ${#failed[@]} -gt 0 ]; then
  echo "Failed: ${failed[*]}"; exit 1
fi
echo "All passed"
