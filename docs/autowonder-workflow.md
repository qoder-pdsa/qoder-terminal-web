# qoder-wonder (AutoWonder) × QoderCLI Workflow

Platform: https://wonder.qoder.live (qoder-wonder, AutoWonder 0.8.0 community edition), workspace **qoder-terminal** (id 10001).

The platform frontend is built from the fork `~/Projects/qoder-wonder` (AutoWonder 0.8.0 community + zh-CN/en-US i18n + layout fixes; see its README).
Deployed 2026-09-19 by rewriting `BOOT-INF/classes/static` inside `/opt/qoder-wonder/auto-wonder.jar` with `scripts/replace-frontend-static.sh`;
previous jars are kept as `/opt/qoder-wonder/auto-wonder.jar.bak-<stamp>` (`…-20260919111008` = original i18n build, `…-20260919134807` = first fork build). Roll back with
`cp /opt/qoder-wonder/auto-wonder.jar.bak-<stamp> /opt/qoder-wonder/auto-wonder.jar && systemctl restart qoder-wonder`.
The build artifact reaches the host through Cloud Assistant `RunCommand` in 12 KB base64 chunks (no SSH/OSS from the workstation).

## Infrastructure (Alibaba Cloud Hong Kong, one VPC)

| Instance | Private IP | Role |
|---|---|---|
| `qoder-wonder-260917-app` | 10.23.1.191 | qoder-wonder platform (systemd + nginx + MySQL + Redis) |
| `qoder-wonder-260917-executor` | 10.23.1.192 | Digital worker executors (`qoderworker` user) |
| `qoder-terminal-app` | 10.23.1.193 | Qoder Terminal production environment; see [deployment.md](deployment.md) |

## Squad: Standard Automated Delivery

Initialized from the official `initialize-autowonder-harness` skill template, with the project variables filled in for this project (database, review target `main`, deployment method), then condensed to 4 + 1 + 4 steps. All squad, digital worker, and SDLC content is in English.

| Digital worker | roleCode | SDLC | Repo permission | Executor | Model |
|---|---|---|---|---|---|
| Full-Stack Developer | AW_FS_DEV | Full-Stack Development (4 steps) | WRITE | qt-fs-dev-1 | Qwen3.8-Max 1M |
| Demo Developer | AW_FS_DEV | Demo Fast Track (3 steps) | WRITE (web only) | qt-demo-dev-1 | Qwen3.8-Max 1M |
| Code Reviewer | AW_CR | Code Review (1 step) | READ | qt-cr-1 | Qwen3.8-Max 1M |
| QA & Deployment Engineer | AW_QA | QA & Deployment (4 steps) | WRITE | qt-qa-1 | Qwen3.8-Max 1M |
| Requirements Analyst | AW_REQ_CLARIFIER | — | READ | qt-req-1 | GLM-5.3 400K |
| Project Manager | AW_PM | — | READ | qt-pm-1 | GLM-5.3 400K |

## Executor deployment (executor instance)

- systemd template service `qoder-terminal-executor@<name>` with the launcher `/opt/qoder-terminal-executors/run.sh`;
  per-executor config in `/etc/qoder-terminal-executors/<name>.env` (600, contains the executor token, never committed), logs in `/var/log/qoder-terminal-executors/<name>.log`.
- **Each executor has its own HOME**: `/var/lib/qoder-wonder-executor/homes/<name>`. The runtime derives its pid, config.json, and assignment queue from HOME,
  so a shared HOME makes runtimes overwrite each other and pick up each other's tasks. Shared content is symlinked back to `/var/lib/qoder-wonder-executor`: `.qoder` (qodercli login state), `.local` (qodercli), `.ssh`, `.gitconfig`, `.config`.
- Executors connect to the platform over the private network at `ws://10.23.1.191:7001/ws/executor`.

## Git permissions

- The four repos are public; fetches use anonymous HTTPS.
- Pushes: one writable deploy key per repo (GitHub allows a deploy key on only one repo);
  `~/.ssh/config` defines an SSH alias per repo, plus `git config --global url.<alias>.pushInsteadOf https://github.com/qoder-pdsa/<repo>.git`.

## QA deployment channel

- The executor runs `ssh qoder-terminal-app deploy.sh <subcommand>` (private network, BatchMode).
- `qtdeploy` authorized_keys on the deployment host: `command="/usr/local/bin/qt-ssh-gate",restrict,from="10.23.1.192"`,
  allowing only allowlisted deploy.sh subcommands (source: `deploy/ssh-gate.sh`).
- Security group: port 22 on the deployment host is open only to 10.23.1.192; port 80 is public.

## Roles × commands

| Role | What it does | Reference |
|---|---|---|
| Requirements Analyst / Project Manager | Split `backlog/` epics into per-repo work items and order dependencies (contract provider first) | `backlog/_template.md` |
| Full-Stack Developer (QoderCLI) | Baseline `make test` → TDD → `make lint test` → push the business branch and hand off to CR | Each repo's `AGENTS.md` |
| Code Reviewer | Read-only review: contract consistency, floating-point prices, error handling, credentials | `.qoder/rules/autowonder-delivery.md` |
| QA & Deployment Engineer | `deploy.sh sync <branch> / build` → `db-status / db-backup / db-migrate` → `up / health` → e2e → hand off for human acceptance | [deployment.md](deployment.md) |

## SDLC steps

| SDLC | Step | What it covers |
|---|---|---|
| Full-Stack Development | 1. Scope, Branch, and Legacy Baseline | Run type, acceptance points, business branch, pre-change `make test` and characterization baseline |
| | 2. TDD Implementation | Contract first, failing test first, minimal implementation, SQL scripts only |
| | 3. Characterization Regression and Pre-verification | Rerun characterization vs. baseline, `make lint test`, acceptance mapping |
| | 4. Commit and Review Handoff | Push the business branch, summary and evidence, hand off to `AW_CR` |
| Code Review | 1. Review and Routing | Read-only PASS/REJECT; PASS → `AW_QA`, defects → `AW_FS_DEV` |
| QA & Deployment | 1. Delivery Intake and Deployment Preparation | Check CR, choose **preview mode** (branch only in web) or **production mode** (backend touched → `deploy.sh sync <branch>` + `build`), decide the database scope |
| | 2. Database Change | `db-status` → `db-backup` → `db-migrate` → `db-status`, or justified no-op |
| | 3. Deployment and Health Check | Preview mode: `deploy.sh preview <branch>` → `https://qoder.live/preview/<slug>/`; production mode: `deploy.sh up`; then `health` with all 6 checks OK |
| | 4. Post-deployment Tests and Human Acceptance | Playwright against the preview or production URL (`PREVIEW_SLUG`, `WEB_URL`), status transition, human acceptance handoff with that URL |

## Branch policy

The reviewed **business branch itself is what gets deployed**. Digital workers never push or merge `main`;
`deploy.sh sync <branch>` checks that branch out in the repo that has it and `main` everywhere else,
and a human fast-forwards `main` after accepting the running result. Frontend-only work items are accepted on their own preview URL
(see [deployment.md](deployment.md) → Per-branch frontend previews); production is released afterwards with `deploy.sh sync main` → `build` → `up`.

## Evidence budget

One authoritative `evidence/report.md` per work item, kept under **20 KB**: conclusions, exact commands, counts, and file paths.
Raw logs are saved once and referenced by path, never pasted into the summary or into work item comments.
This keeps the per-step context from snowballing across the pipeline.

## Demo Fast Track (SDLC 10003, workType TASK, squad 10001)

A live-demo flow for **frontend-only** TASK items: two digital workers, about 30 minutes. The Full-Stack Developer
implements, publishes a branch preview and runs e2e (3 steps), then hands off to the Code Reviewer, whose PASS goes
straight to human acceptance on the preview URL. No QA deployment step. Not for backend or database changes — those go
through the full pipeline. The squad **Demo Fast Track** (10001) contains only these two roles, so the delivery-progress
panel shows exactly the lanes that run.

| Step | Owner | What it does | Timeout |
|---|---|---|---|
| 1. TDD Implementation | Full-Stack Developer | Branch from `main`, `npm ci`, one baseline `make test`, failing test → minimal code, `make lint test`; no servers/browsers | 25 min |
| 2. Push, Preview, and e2e | Full-Stack Developer | Push the branch, `deploy.sh preview <branch>`, `health` 6/6, Playwright api + ui against the preview; URL in the step timeline and a work item comment | 20 min |
| 3. Review Handoff | Full-Stack Developer | Summary ≤ 10 KB, handoff to `AW_CR` with the preview URL first in the reason | 10 min |
| Code Review (SDLC 10001) | Code Reviewer | Read-only review; fast-track PASS → HUMAN acceptance with `Accept at <preview URL>`; REJECT → developer on the same branch | 25 min |

**How to trigger one on stage** (MCP or UI): the flow is chosen by **who you assign the work item to** — each digital
worker runs its own default SDLC, and cross-role routing is written into the step instructions.

| Entry role | Default SDLC | Squad | Use for |
|---|---|---|---|
| Full-Stack Developer (10001) | 10000 Full-Stack Development → CR → QA → human | Standard Automated Delivery (10000) | REQ / BUG, backend or multi-repo work |
| **Demo Developer (10006, executor `qt-demo-dev-1`)** | 10003 Demo Fast Track → CR → human | Demo Fast Track (10001) | frontend-only TASK items on stage |

1. Create a **TASK** work item from `backlog/DEMO-fast-track.md` (or any small frontend change).
2. Assign it to **Demo Developer** with squad **Demo Fast Track**. Nothing else to switch; the developer's default SDLC does the rest
   (passing `sdlcId` at assignment is not enough on its own — a comment-triggered continuation falls back to the assignee's default SDLC).
3. Watch the dispatch's step timeline: step 2 posts `Preview URL: https://qoder.live/preview/<slug>/`; the reviewer's handoff puts the same URL on your task card.
4. Open the preview, accept, move the TASK to `done`, merge the branch into `main`, release with `deploy.sh sync main → build → up → health`.

Measured on DEMO-1 (2026-09-19): implementation 5 min, preview + e2e 13 min, handoff 3 min, review 11 min — about **35 minutes** from dispatch to the human's task card.
