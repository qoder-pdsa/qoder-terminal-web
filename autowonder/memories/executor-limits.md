---
title: Executor host has 4 GB and no shared caches — memory pressure looks like test failures, checkout helpers can fail
type: CONSTRAINT
scope: ORG
---

## Fact

All digital workers run on one executor host (`qoder-wonder-260917-executor`, 4 GB RAM since 2026-09-20, previously 2 GB). Each executor has its own `HOME` and workspace; nothing is shared between dispatches except the read-only qodercli install and git credentials.

Two failure modes seen repeatedly:

1. **Every Playwright `ui` test times out** (`Test timeout of 30000ms exceeded` while creating the browser context or in `page.goto`) while the `api` project passes and `curl` of the same page returns in milliseconds. That is memory starvation on the executor, not an application defect. It disappeared with the 2 → 4 GB upgrade with no code change.
2. **The runtime's `repo-checkout` helper answers HTTP 500 `network access is disabled and repo is not cached`** even though the dispatch package allows network. Plain `git clone` / `git fetch` from Bash works.

## How to apply

- Before reporting a uniform `ui` failure as a bug: `free -m`, `curl -sS -o /dev/null -w '%{http_code} %{time_total}' <url>`, and run the suite once with `--workers=1`. Record the numbers in the evidence.
- Do not run `vite build`, Playwright and a Go build at the same time on the executor; run them sequentially.
- When `repo-checkout` fails, clone the package-declared repo URL into the workspace with plain git and continue; note the helper error as an environment gap. It is never grounds for a REJECT.
