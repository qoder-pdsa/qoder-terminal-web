#!/usr/bin/env bash
# Qoder Terminal 生产部署入口（AutoWonder QA 数字人按步骤调用，每步独立、可重复执行）
#
#   deploy.sh sync <branch>   四个 repo 更新到 origin/<branch>，输出候选提交
#   deploy.sh build           构建全部镜像（与启动分离），输出镜像摘要
#   deploy.sh db-status       查看 Flyway 迁移记录（只读）
#   deploy.sh db-backup       备份 PostgreSQL 到 /opt/qoder-terminal/backups
#   deploy.sh db-migrate      执行 Flyway 迁移（仅数据库步骤调用）
#   deploy.sh up              使用已构建镜像替换并启动服务（不构建、不迁移）
#   deploy.sh health          健康检查，全部通过返回 0
#   deploy.sh status          容器状态与当前部署版本
#   deploy.sh logs <service>  最近 200 行服务日志（data/analyst/user/web/postgres）
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
    # 部署目录只做只读检出：存在本地改动时拒绝覆盖
    if [ -n "$(git -C "$dir" status --porcelain)" ]; then
      log "ERROR $repo 部署目录存在未提交改动，拒绝覆盖"; exit 1
    fi
    git -C "$dir" fetch -q origin "$branch"
    git -C "$dir" checkout -q --detach "origin/$branch"
    log "$repo @ $(git -C "$dir" log -1 --format='%h %s')"
  done
}

cmd_build() {
  "${COMPOSE[@]}" build --pull 2>&1 | tail -n 20
  "${COMPOSE[@]}" images 2>/dev/null || docker images 'qoder-terminal/*' --format '{{.Repository}}:{{.Tag}} {{.ID}} {{.CreatedSince}}'
}

# exec 一律从 /dev/null 读取 stdin：否则通过管道/heredoc 调用本脚本时，会吞掉调用方后续命令
psql_q() { "${COMPOSE[@]}" exec -T postgres psql -U qoder -d qoder -v ON_ERROR_STOP=1 -At -c "$1" </dev/null; }

cmd_db_status() {
  "${COMPOSE[@]}" up -d --quiet-pull postgres >/dev/null 2>&1
  wait_healthy postgres
  if [ "$(psql_q "select to_regclass('qoder_user.flyway_schema_history') is not null")" = "t" ]; then
    psql_q "select version, description, success, installed_on from qoder_user.flyway_schema_history order by installed_rank"
  else
    log "qoder_user schema 尚未初始化"
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
  log "ERROR $1 未在 120 秒内就绪"; return 1
}

check() {
  # 服务启动需要时间（Java 约 15 秒）：每项最多重试 90 秒
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
