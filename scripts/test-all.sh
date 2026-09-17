#!/usr/bin/env bash
# 依次运行四个 repo 的 lint + 单测，汇总结果
set -uo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PARENT="$(dirname "$HERE")"
failed=()
for repo in qoder-terminal-data qoder-terminal-analyst qoder-terminal-user qoder-terminal-web; do
  echo "==> $repo"
  (cd "$PARENT/$repo" && make lint test) || failed+=("$repo")
done
if [ ${#failed[@]} -gt 0 ]; then
  echo "失败: ${failed[*]}"; exit 1
fi
echo "全部通过"
