#!/usr/bin/env bash
# Qoder Terminal production deployment entry point (called step by step by the AutoWonder QA digital worker; every step is independent and re-runnable)
#
#   deploy.sh sync <branch>   check out origin/<branch> in every repo that has it, origin/main elsewhere,
#                             and print the candidate commits
#   deploy.sh build           build all images (separate from startup) and print image digests
#   deploy.sh db-status       show Flyway migration history (read-only)
#   deploy.sh db-backup       back up PostgreSQL to /opt/qoder-terminal/backups
#   deploy.sh db-migrate      run Flyway migrations (database step only)
#   deploy.sh up              replace and start services from built images (no build, no migration)
#   deploy.sh health          health checks; exits 0 only when all pass
#   deploy.sh status          container status and currently deployed versions
#   deploy.sh logs <service>  last 200 log lines of a service (data/analyst/user/web/postgres)
set -euo pipefail

ROOT=${QT_ROOT:-/opt/qoder-terminal}
SRC=${QT_SRC:-$ROOT/src}
REPOS=(qoder-terminal-data qoder-terminal-analyst qoder-terminal-user qoder-terminal-web)
COMPOSE=(docker compose -f "$SRC/qoder-terminal-web/deploy/docker-compose.prod.yml")
BASE_URL=${QT_BASE_URL:-http://127.0.0.1}

log() { printf '[deploy %s] %s\n' "$(date '+%F %T')" "$*"; }

cmd_sync() {
  local branch=${1:?usage: deploy.sh sync <branch>}
  for repo in "${REPOS[@]}"; do
    local dir="$SRC/$repo"
    if [ ! -d "$dir/.git" ]; then
      git clone -q "https://github.com/qoder-pdsa/$repo.git" "$dir"
    fi
    # Deployment directories are read-only checkouts: refuse to overwrite local changes
    if [ -n "$(git -C "$dir" status --porcelain)" ]; then
      log "ERROR $repo deployment directory has uncommitted changes; refusing to overwrite"; exit 1
    fi
    git -C "$dir" fetch -q --prune origin
    # A feature branch exists in one repo only; every other repo stays on main
    local want="$branch"
    if ! git -C "$dir" rev-parse -q --verify "origin/$branch" >/dev/null; then want=main; fi
    git -C "$dir" checkout -q --detach "origin/$want"
    log "$repo @ $want $(git -C "$dir" log -1 --format='%h %s')"
  done
}

cmd_build() {
  "${COMPOSE[@]}" build --pull 2>&1 | tail -n 20
  "${COMPOSE[@]}" images 2>/dev/null || docker images 'qoder-terminal/*' --format '{{.Repository}}:{{.Tag}} {{.ID}} {{.CreatedSince}}'
}

# exec always reads stdin from /dev/null; otherwise, when this script is driven by a pipe/heredoc, it swallows the caller's remaining commands
psql_q() { "${COMPOSE[@]}" exec -T postgres psql -U qoder -d qoder -v ON_ERROR_STOP=1 -At -c "$1" </dev/null; }

cmd_db_status() {
  "${COMPOSE[@]}" up -d --quiet-pull postgres >/dev/null 2>&1
  wait_healthy postgres
  if [ "$(psql_q "select to_regclass('qoder_user.flyway_schema_history') is not null")" = "t" ]; then
    psql_q "select version, description, success, installed_on from qoder_user.flyway_schema_history order by installed_rank"
  else
    log "qoder_user schema is not initialized yet"
  fi
}

cmd_db_backup() {
  "${COMPOSE[@]}" up -d --quiet-pull postgres >/dev/null 2>&1
  wait_healthy postgres
  mkdir -p "$ROOT/backups"; chmod 700 "$ROOT/backups"
  local file="$ROOT/backups/qoder-$(date +%Y%m%d%H%M%S).sql.gz"
  "${COMPOSE[@]}" exec -T postgres pg_dump -U qoder -d qoder </dev/null | gzip > "$file"
  chmod 600 "$file"
  log "backup: $file ($(du -h "$file" | cut -f1))"
}

cmd_db_migrate() {
  "${COMPOSE[@]}" --profile migrate run --rm user-migrate </dev/null
  cmd_db_status
}

cmd_up() {
  "${COMPOSE[@]}" up -d --no-build --quiet-pull --remove-orphans </dev/null 2>&1 | grep -vE "Pull|Download|Extract|Verif|Waiting" || true
  cmd_status
}

wait_healthy() {
  for _ in $(seq 1 60); do
    [ "$("${COMPOSE[@]}" ps --format '{{.Health}}' "$1" 2>/dev/null)" = "healthy" ] && return 0
    sleep 2
  done
  log "ERROR $1 did not become ready within 120 seconds"; return 1
}

check() {
  # Services need time to start (Java takes ~15s): retry each check for up to 90 seconds
  local name=$1 url=$2 expect=$3 body=""
  for _ in $(seq 1 45); do
    if body=$(curl -fsS -m 10 "$url" 2>&1) && printf '%s' "$body" | grep -q "$expect"; then
      log "OK   $name"; return 0
    fi
    sleep 2
  done
  log "FAIL $name → $(printf '%s' "$body" | head -c 200)"; return 1
}

cmd_health() {
  local failed=0
  check "web gateway"      "$BASE_URL/healthz"                      '"ok"'      || failed=1
  check "data /health"     "$BASE_URL/api/data/health"              '"ok"'      || failed=1
  check "analyst /health"  "$BASE_URL/api/analyst/health"           '"ok"'      || failed=1
  check "user /health"     "$BASE_URL/api/user/health"              '"ok"'      || failed=1
  check "data quote"       "$BASE_URL/api/data/v1/quotes/700.HK"    '"HKD"'     || failed=1
  check "web index"        "$BASE_URL/"                             'Qoder Terminal' || failed=1
  return $failed
}

cmd_status() {
  "${COMPOSE[@]}" ps --format 'table {{.Service}}\t{{.Status}}\t{{.Image}}'
  for repo in "${REPOS[@]}"; do
    [ -d "$SRC/$repo/.git" ] && printf '%-24s %s\n' "$repo" "$(git -C "$SRC/$repo" log -1 --format='%h %s')"
  done
}

case "${1:-}" in
  sync) shift; cmd_sync "$@" ;;
  build) cmd_build ;;
  db-status) cmd_db_status ;;
  db-backup) cmd_db_backup ;;
  db-migrate) cmd_db_migrate ;;
  up) cmd_up ;;
  health) cmd_health ;;
  status) cmd_status ;;
  logs) shift; "${COMPOSE[@]}" logs --no-color --tail 200 "${1:?usage: deploy.sh logs <service>}" </dev/null ;;
  *) sed -n '2,13p' "$0"; exit 2 ;;
esac
