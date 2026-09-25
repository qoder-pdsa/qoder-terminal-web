---
name: qoder-terminal-delivery
description: Use at the start of every Qoder Terminal work item — the four repos, their commands, the non-negotiable rules (contract first, decimal prices, branch policy, evidence budget) and what each role hands to the next.
---

# Qoder Terminal delivery handbook

Qoder Terminal is a Bloomberg-style Hong Kong stock terminal delivered by a digital-worker pipeline:
**Full-Stack Developer → Code Reviewer → QA & Deployment Engineer → human acceptance**.
Read this first; the repo-specific skills (`qoder-terminal-web`, `qoder-terminal-data`, `qoder-terminal-deploy`) build on it.

## The four repos (sibling directories, all public on GitHub `qoder-pdsa/`)

| Repo | Language | Owns | Port | Lint + test |
|---|---|---|---|---|
| `qoder-terminal-data` | Go 1.26 | `api/openapi.yaml` — quotes, history, indicators, news, watchlists, capital flow, intraday | 8081 | `make lint test` (vet + gofmt + redocly + `go test`) |
| `qoder-terminal-analyst` | Python 3.12 / FastAPI / uv | `api/openapi.yaml`, `api/agent-event.schema.json` — the `ASK` agent (SSE) | 8082 | `make lint test` (ruff + mypy strict + pytest) |
| `qoder-terminal-user` | Java 25 / Spring Boot 4 / Maven | `api/openapi.yaml`, JWT claims, Flyway migrations (PostgreSQL) | 8084 | `make lint test` |
| `qoder-terminal-web` | TypeScript / React 19 / Vite | Consumer of all contracts; holds `e2e/`, `docs/`, `backlog/`, `deploy/`, `shared-rules/` | 5173 | `make lint test` (tsc + vitest + deploy script tests) |

`qoder-terminal-web/AGENTS.md`, `qoder-terminal-data/AGENTS.md`, … are the per-repo guides; `shared-rules/autowonder-delivery.md` is the shared rule set.
Local stack for e2e: `./scripts/dev.sh` in web (data mock + analyst + web), then `make e2e-api` / `make e2e-ui`.

## Rules that are never negotiable

1. **Contract first.** A cross-repo change edits the provider repo's `api/openapi.yaml` (and `make lint-api` passes) *before* any code; consumers never invent fields. Breaking changes go to a new `/v2` path.
2. **Prices are decimal strings.** Every price, change, amount is a string like `"438.4000"`. Go math goes through `internal/money`; TypeScript never calls `parseFloat` on a price — display strings as-is, compare with `compareDecimal` (BigInt), convert to a number only inside the one chart-data function. Errors are `{"code","message"}`.
3. **Symbols** look like `700.HK`, `AAPL.US`, `600519.SH`, and can be up to 20 characters (`MSFT261016P420000.US` options come from real watchlists): `^[0-9A-Z]{1,20}\.(HK|US|SH|SZ)$`. Hong Kong is the default market — bare `700` means `700.HK`, priced in HKD. Up/down colors follow HKEX: **red = up, green = down** (`--candle-up` / `--candle-down`).
4. **Branch policy.** Work on `feature/<slug>-<timestamp>` (or `fix/…`) cut from `main`. Digital workers **never push or merge `main`**; QA deploys the business branch itself and a human fast-forwards `main` after acceptance.
5. **TDD with a baseline.** Run `make test` before touching code and record the result; write the failing test, implement minimally, refactor; `make lint test` must fully pass — zero tests, skipped tests or unexecuted runs do not count.
6. **No real network in unit tests.** External SDKs live behind small interfaces (`quoteAPI` in Go, injected `httpx` clients in Python) and tests use fakes.
7. **Secrets** come from environment variables only (`/etc/qoder-terminal/qoder-terminal.env` on the host); never commit `.env`, never print a token.
8. **Evidence budget.** One `evidence/report.md` per work item, under 20 KB: conclusions, exact commands, counts, file paths. Raw logs are saved once and referenced by path, never pasted into comments.
9. **Dependencies are the developer's job.** `npm ci`, `go mod download`, `uv sync` inside the workspace are expected; "no installs" in a step means no *new* project dependencies without justification.

## Hand-offs

| From → to | What must be in the handoff reason |
|---|---|
| Developer → `AW_CR` | branch name + HEAD sha, `make lint test` result line, list of changed files, and — for frontend work — the preview URL **first** (`https://qoder.live/preview/<slug>/`) |
| Code Reviewer → `AW_QA` (standard) or HUMAN (fast track) | PASS/REJECT with file:line references; a fast-track PASS says `Accept at <preview URL>` |
| QA → HUMAN | deployed commits per repo, `deploy.sh health` 6/6, e2e counts, the URL to accept on |

## What "done" looks like for the human

The human accepts on a running URL (a branch preview or production), moves the work item to done, merges the branch into `main` and releases with `deploy.sh sync main → build → up → health`. Nothing you do on the board triggers a release.
