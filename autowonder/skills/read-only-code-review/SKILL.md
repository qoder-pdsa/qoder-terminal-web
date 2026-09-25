---
name: read-only-code-review
description: Use when reviewing a Qoder Terminal delivery as Code Reviewer — what to verify without running builds, the project-specific defect checklist, how to validate test and merge evidence from git alone, and how to route PASS / REJECT.
---

# Read-only code review

You do not build, test, deploy or modify code. You read the diff, the contracts and the developer's evidence, and you decide.
The handoff reason from the developer must name the branch and HEAD sha; if it names a preview URL, the item is on the Demo Fast Track.

## 1. Get the authoritative diff

```
git clone --no-checkout https://github.com/qoder-pdsa/<repo>.git scratch/<repo>   # read-only, outside artifacts/
git -C scratch/<repo> fetch origin <branch> main
git -C scratch/<repo> diff origin/main...origin/<branch> --stat
git -C scratch/<repo> diff origin/main...origin/<branch>
```
If the runtime's `repo-checkout` helper fails ("network access is disabled and repo is not cached", HTTP 500), that is an environment gap, not a delivery defect: note it and use plain git as above. Never REJECT for it.

## 2. Verify the evidence without re-running anything

| Claim | How to check from git alone |
|---|---|
| "`make lint test` passes" | tests exist for every new pure function/handler (`*_test.go`, `*.test.ts`, `tests/test_*.py`); new code paths have assertions, not just smoke calls; no `t.Skip`, `it.skip`, `xit`, `@pytest.mark.skip` added |
| "e2e passes on the preview" | the e2e spec change is in the diff; the preview URL in the handoff matches the branch slug; fetch the preview `index.html` and one hashed asset with `curl` (200) |
| "branch is based on main" | `git merge-base --is-ancestor origin/main origin/<branch>`; the diff touches only files the work item implies |
| "contract unchanged / changed" | `git diff origin/main...origin/<branch> -- api/openapi.yaml`; a consumer change without the provider's contract change is a REJECT |
| "no secrets" | `git diff … | grep -iE 'api[_-]?key|secret|token|password'`; `.env` never in the diff |

## 3. Project-specific defect checklist

- **Decimal discipline**: no `parseFloat`/`Number()` on prices outside the single chart-data conversion function (web); no `float64` price math (Go); `money.Decimal` for change/percent/net.
- **Contract mirror**: TypeScript types in `src/api/*.ts` match `openapi.yaml` field names and optionality; Go handlers emit `[]` not `null` for empty arrays; error bodies are `{"code","message"}`.
- **Symbols**: pattern `^[0-9A-Z]{1,20}\.(HK|US|SH|SZ)$` consistent across `openapi.yaml`, `handlers.go`, `parse.ts`.
- **Not-found vs empty**: pre-open/empty upstream data must be 200 + empty, never 404 or 502.
- **Upstream bursts**: a new endpoint that calls Longbridge per request for data another panel already fetches needs the `Cached` layer (rate limit 301606).
- **React**: `AbortController` cleanup in every fetching effect; intervals cleared on unmount; immutable state updates; `data-testid` on interactive elements; colors from CSS variables only; charts through `createTerminalChart`.
- **Tests**: no real network (fakes / `httpx.MockTransport`); no `waitForTimeout`; new function codes covered in `parse.test.ts` and one UI e2e.
- **Scope**: only the work item's files; no "while I'm here" refactors; no changes to `deploy/` or `shared-rules/` unless the item is about them.

## 4. Decide and route

- **PASS** → standard pipeline: hand off to `AW_QA` with branch + sha + which repos changed (QA picks preview vs production mode from that).
  Demo Fast Track (preview URL in the handoff): hand off to **HUMAN** with `Accept at <preview URL>`.
- **REJECT** → back to the same developer on the same branch, with `file:line` references, the rule violated, and what a fix looks like. Group findings by severity; one REJECT with everything beats three round trips.
- Do not REJECT for style you would merely prefer, for missing work outside the item's acceptance criteria, or for environment problems (executor memory, checkout helper, proxies).

Your review summary goes in `evidence/report.md` (< 20 KB): commands run, facts found, verdict.
