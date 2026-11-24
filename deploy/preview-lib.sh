#!/usr/bin/env bash
# Shared helpers for per-branch frontend previews (sourced by deploy.sh; unit tests in preview-lib.test.sh)

PREVIEW_SLUG_MAX=40

# preview_slug <branch>: the URL/directory name for a branch.
# Drops the type prefix (feature/, fix/, ...), lowercases, replaces runs of anything outside [a-z0-9] with one dash,
# trims dashes at both ends and truncates to PREVIEW_SLUG_MAX characters.
preview_slug() {
  local branch=$1 slug
  case "$branch" in */*) slug=${branch#*/} ;; *) slug=$branch ;; esac
  slug=$(printf '%s' "$slug" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')
  slug=${slug:0:$PREVIEW_SLUG_MAX}
  printf '%s' "${slug%%-}"
}

# preview_validate_slug <slug>: exits non-zero unless the slug is safe to use as a path segment
preview_validate_slug() {
  local slug=$1
  if [[ "$slug" =~ ^[a-z0-9-]{1,40}$ ]]; then return 0; fi
  echo "invalid preview slug '$slug': allowed = [a-z0-9-]{1,40}" >&2
  return 1
}

# preview_resolve_mode [arg]: normalize the optional second argument of `deploy.sh preview`
preview_resolve_mode() {
  local mode=${1:-default}
  case "$mode" in
    default | isolated) printf '%s' "$mode" ;;
    *) echo "unknown preview mode '$mode': use 'default' or 'isolated'" >&2; return 1 ;;
  esac
}

# preview_isolated_slug <slug>: the directory/URL name of the isolated demo preview of one branch.
# The base is cut back so the '-iso' suffix always fits inside PREVIEW_SLUG_MAX, which keeps the
# isolated preview a separate directory instead of truncating into the ordinary preview's slug.
preview_isolated_slug() {
  local base=${1:0:$((PREVIEW_SLUG_MAX - 4))}
  printf '%s-iso' "${base%%-}"
}

# preview_build_args <mode> <slug>: the docker build args for one preview bundle.
# 'default' is the historical behaviour: the bundle talks to the shared backend through /api/*.
# 'isolated' additionally sets VITE_ISOLATED_DEMO, which makes the bundle refuse every business call,
# and points both business URLs at a path inside the preview itself, so even a stray request is served
# statically by the preview's own location and can never be proxied to data/analyst.
preview_build_args() {
  local mode=$1 slug=$2
  case "$mode" in
    default) ;;
    isolated) ;;
    *) echo "unknown preview mode '$mode'" >&2; return 1 ;;
  esac
  printf -- '--build-arg VITE_BASE=/preview/%s/' "$slug"
  if [ "$mode" = isolated ]; then
    printf -- ' --build-arg VITE_ISOLATED_DEMO=1'
    printf -- ' --build-arg VITE_DATA_URL=/preview/%s/no-backend' "$slug"
    printf -- ' --build-arg VITE_ANALYST_URL=/preview/%s/no-backend' "$slug"
  else
    printf -- ' --build-arg VITE_DATA_URL=/api/data --build-arg VITE_ANALYST_URL=/api/analyst'
  fi
}
