---
name: qoder-terminal-deploy
description: Use for the QA & Deployment steps of a Qoder Terminal work item — choosing preview vs production mode, the exact deploy.sh sequence, the database step, health and post-deployment e2e, and what to hand to the human.
---

# qoder-terminal-deploy

Production runs on `qoder-terminal-app` (10.23.1.193): docker compose with postgres + user + data + analyst + web, fronted by
`https://qoder.live` (previews at `https://qoder.live/preview/<slug>/`). Everything is driven by `deploy/deploy.sh` in `qoder-terminal-web`,
reached from the executor as `ssh qoder-terminal-app deploy.sh <subcommand>` (BatchMode, forced-command gate; only the subcommands below are allowed).

## Step 1 — choose the mode

| The reviewed branch exists in… | Mode | Why |
|---|---|---|
| only `qoder-terminal-web` | **preview** | one URL per ticket, production untouched, shares the production backend |
| `qoder-terminal-data` / `analyst` / `user` (with or without web) | **production** | there is one backend; previews cannot show backend changes |

Check with `git ls-remote https://github.com/qoder-pdsa/<repo>.git <branch>` for each repo. Record the mode and the reason in the evidence.

## Step 2 — database

Only `qoder-terminal-user` has a database (PostgreSQL, Flyway, migrations never run on startup).
- Work item touches user migrations: `deploy.sh db-status` → `deploy.sh db-backup` → `deploy.sh db-migrate` → `deploy.sh db-status` (paste the version table into the evidence).
- Otherwise: mark the step **not applicable** with the justification "no migration scripts in the delivered branch" — do not run a migration "just in case".

## Step 3 — deploy

Preview mode:
```
deploy.sh preview <branch>        # builds a clean export of origin/<branch>, publishes /preview/<slug>/
deploy.sh health                  # must print 6× OK
```
Production mode:
```
deploy.sh sync <branch>           # checks out origin/<branch> in every repo that has it, origin/main elsewhere; prints the candidate commits
deploy.sh build                   # images only, no restart
deploy.sh up                      # replace + start; prints the deployed commit per repo
deploy.sh health                  # web gateway, data/analyst/user /health, data quote, web index — all OK
```
Slug rule for previews: branch minus `feature/` or `fix/`, lowercased, runs of non `[a-z0-9]` → `-`, max 40 chars. `deploy.sh preview-ls` lists live previews (max 10, 7 days).
`deploy.sh logs <data|analyst|user|web|postgres>` for the last 200 lines when a check fails; `deploy.sh status` for container status + versions.

## Step 4 — post-deployment tests and handoff

Run Playwright from the web repo **against the deployed URL**, never against localhost:
```
WEB_URL=https://qoder.live/preview/<slug>/  DATA_URL=https://qoder.live/api/data  ANALYST_URL=https://qoder.live/api/analyst \
PREVIEW_SLUG=<slug>  npx playwright test -c e2e/playwright.config.ts --project=api --project=ui
```
(production: `WEB_URL=https://qoder.live`, no `PREVIEW_SLUG`). Report `N passed` with the command; a run with 0 tests or all skipped is a failure.
The executor has 4 GB; if every `ui` test times out while `api` passes and `curl` of the page is instant, that is memory pressure on the executor, not the app — check `free -m` before blaming the delivery.

Handoff to the human: mode, deployed commit per repo (from `deploy.sh up`), health line, e2e counts, and the URL to accept on (`Accept at <url>`).

## Never

- Never push, merge or reset `main` — a human fast-forwards it after acceptance and releases with `sync main → build → up → health`.
- Never edit `/opt/qoder-terminal/src/*` by hand, never run `docker compose` directly, never migrate without a backup, never paste credentials or `.env` contents into evidence.
- Test results on mock data are not post-deployment evidence.
