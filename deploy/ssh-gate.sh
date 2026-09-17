#!/usr/bin/env bash
# SSH forced command: the executor (AutoWonder QA digital worker) may only call allowlisted deploy.sh subcommands.
# Install as /usr/local/bin/qt-ssh-gate with command="/usr/local/bin/qt-ssh-gate",restrict in authorized_keys
set -euo pipefail
DEPLOY=/opt/qoder-terminal/src/qoder-terminal-web/deploy/deploy.sh
read -r -a args <<< "${SSH_ORIGINAL_COMMAND:-}"
# Accept "deploy.sh <sub> [arg]" or the subcommand without deploy.sh
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
