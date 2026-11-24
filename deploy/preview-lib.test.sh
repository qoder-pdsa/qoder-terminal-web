#!/usr/bin/env bash
# Unit tests for deploy/preview-lib.sh (run by `make test`); plain bash, no framework
set -euo pipefail
cd "$(dirname "$0")"
# shellcheck source=preview-lib.sh
. ./preview-lib.sh

fails=0
expect_slug() { # branch expected
  local got; got=$(preview_slug "$1")
  [ "$got" = "$2" ] && echo "ok   slug '$1' -> '$got'" || { echo "FAIL slug '$1' -> '$got' (want '$2')"; fails=1; }
}
expect_valid() { preview_validate_slug "$1" >/dev/null 2>&1 && echo "ok   valid '$1'" || { echo "FAIL '$1' should be valid"; fails=1; }; }
expect_invalid() { preview_validate_slug "$1" >/dev/null 2>&1 && { echo "FAIL '$1' should be rejected"; fails=1; } || echo "ok   rejected '$1'"; }

# The branch type prefix is dropped, everything else is lowercased and sanitized
expect_slug "feature/bl02-graph-price-panel-20260918123222" "bl02-graph-price-panel-20260918123222"
expect_slug "fix/News_Panel.v2" "news-panel-v2"
expect_slug "main" "main"
# Runs of unsupported characters collapse to one dash; leading/trailing dashes are trimmed
expect_slug "feature/--weird__name--" "weird-name"
# Truncated to 40 characters without leaving a trailing dash
expect_slug "feature/$(printf 'a%.0s' {1..39})-tail" "$(printf 'a%.0s' {1..39})"
# Nested prefixes: only the first path segment is dropped
expect_slug "feature/team/thing" "team-thing"

expect_valid "bl02-graph-price-panel-20260918123222"
expect_valid "a"
expect_invalid ""
expect_invalid ".."
expect_invalid "../etc"
expect_invalid "/abs"
expect_invalid "UPPER"
expect_invalid "has space"
expect_invalid "semi;colon"
expect_invalid "$(printf 'a%.0s' {1..41})"

# --- isolated demo previews (work item 10081 v2): a second mode that never reaches the shared backend
expect_mode() { # arg expected
  local got; got=$(preview_resolve_mode "$1" 2>/dev/null) || got="<rejected>"
  [ "$got" = "$2" ] && echo "ok   mode '$1' -> '$got'" || { echo "FAIL mode '$1' -> '$got' (want '$2')"; fails=1; }
}
expect_isolated_slug() { # slug expected
  local got; got=$(preview_isolated_slug "$1")
  if [ "$got" = "$2" ]; then echo "ok   isolated slug '$1' -> '$got'"; else echo "FAIL isolated slug '$1' -> '$got' (want '$2')"; fails=1; fi
  preview_validate_slug "$got" >/dev/null 2>&1 || { echo "FAIL isolated slug '$got' is not a valid slug"; fails=1; }
}
expect_args() { # mode slug expected
  local got; got=$(preview_build_args "$1" "$2" 2>/dev/null) || got="<rejected>"
  [ "$got" = "$3" ] && echo "ok   args $1/$2" || { echo "FAIL args $1/$2 -> '$got' (want '$3')"; fails=1; }
}

expect_mode "" "default"
expect_mode "default" "default"
expect_mode "isolated" "isolated"
expect_mode "iso" "<rejected>"
expect_mode "ISOLATED" "<rejected>"
expect_mode "prod" "<rejected>"

expect_isolated_slug "demo-10081-xray-20261123" "demo-10081-xray-20261123-iso"
expect_isolated_slug "a" "a-iso"
# A full-length slug keeps the suffix instead of colliding with the ordinary preview of the same branch
expect_isolated_slug "$(printf 'a%.0s' {1..40})" "$(printf 'a%.0s' {1..36})-iso"
expect_isolated_slug "$(printf 'a%.0s' {1..37})-" "$(printf 'a%.0s' {1..36})-iso"

# An ordinary preview keeps exactly the build args deploy.sh has always passed
expect_args "default" "s" "--build-arg VITE_BASE=/preview/s/ --build-arg VITE_DATA_URL=/api/data --build-arg VITE_ANALYST_URL=/api/analyst"
# An isolated preview sets the demo flag and points both business URLs at a path inside the preview
# itself, which the gateway serves statically: no route can reach the shared data/analyst backend.
expect_args "isolated" "demo-10081-xray-20261123-iso" "--build-arg VITE_BASE=/preview/demo-10081-xray-20261123-iso/ --build-arg VITE_ISOLATED_DEMO=1 --build-arg VITE_DATA_URL=/preview/demo-10081-xray-20261123-iso/no-backend --build-arg VITE_ANALYST_URL=/preview/demo-10081-xray-20261123-iso/no-backend"
expect_args "nope" "s" "<rejected>"

[ $fails -eq 0 ] && echo "preview-lib: all tests passed" || { echo "preview-lib: FAILED"; exit 1; }
