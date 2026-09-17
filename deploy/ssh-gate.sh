#!/usr/bin/env bash
# SSH 强制命令：执行器（AutoWonder QA 数字人）只能调用 deploy.sh 的白名单子命令。
# 安装：/usr/local/bin/qt-ssh-gate，authorized_keys 中 command="/usr/local/bin/qt-ssh-gate",restrict
set -euo pipefail
DEPLOY=/opt/qoder-terminal/src/qoder-terminal-web/deploy/deploy.sh
read -r -a args <<< "${SSH_ORIGINAL_COMMAND:-}"
# 允许 "deploy.sh <sub> [arg]" 或省略 deploy.sh
[ "${args[0]:-}" = "deploy.sh" ] && args=("${args[@]:1}")
sub=${args[0]:-}; arg=${args[1]:-}
case "$sub" in
  build|db-status|db-backup|db-migrate|up|health|status) [ ${#args[@]} -eq 1 ] || { echo "denied: $sub takes no arguments" >&2; exit 2; } ;;
  sync) [[ "$arg" =~ ^[A-Za-z0-9._/-]{1,100}$ ]] && [ ${#args[@]} -eq 2 ] || { echo "denied: sync <branch>" >&2; exit 2; } ;;
  logs) [[ "$arg" =~ ^(data|analyst|user|web|postgres)$ ]] && [ ${#args[@]} -eq 2 ] || { echo "denied: logs <data|analyst|user|web|postgres>" >&2; exit 2; } ;;
  *) echo "denied: allowed = deploy.sh sync <branch>|build|db-status|db-backup|db-migrate|up|health|status|logs <service>" >&2; exit 2 ;;
esac
logger -t qt-ssh-gate "deploy.sh ${args[*]}"
exec "$DEPLOY" "${args[@]}"
