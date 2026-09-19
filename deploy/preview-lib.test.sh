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

[ $fails -eq 0 ] && echo "preview-lib: all tests passed" || { echo "preview-lib: FAILED"; exit 1; }
