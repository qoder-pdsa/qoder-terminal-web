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
