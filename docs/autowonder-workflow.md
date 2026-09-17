# qoder-wonder (AutoWonder) × QoderCLI Workflow

Platform: http://47.239.52.168 (qoder-wonder, AutoWonder 0.8.0 community edition), workspace **qoder-terminal** (id 10001).

## Infrastructure (Alibaba Cloud Hong Kong, one VPC)

| Instance | Private IP | Role |
|---|---|---|
| `qoder-wonder-260917-app` | 10.23.1.191 | qoder-wonder platform (systemd + nginx + MySQL + Redis) |
| `qoder-wonder-260917-executor` | 10.23.1.192 | Digital worker executors (`qoderworker` user) |
| `qoder-terminal-app` | 10.23.1.193 | Qoder Terminal production environment; see [deployment.md](deployment.md) |

## Squad: Standard Automated Delivery

Initialized from the official `initialize-autowonder-harness` skill template, with the project variables filled in for this project (database, target branch `main`, deployment method). All squad, digital worker, and SDLC content is in English.

| Digital worker | roleCode | SDLC | Repo permission | Executor | Model |
|---|---|---|---|---|---|
| Full-Stack Developer | AW_FS_DEV | Full-Stack Development (7 steps) | WRITE | qt-fs-dev-1 | Qwen3.8-Max 1M |
| Code Reviewer | AW_CR | Code Review (1 step) | READ | qt-cr-1 | Qwen3.8-Max 1M |
| QA & Deployment Engineer | AW_QA | QA & Deployment (8 steps) | WRITE | qt-qa-1 | Qwen3.8-Max 1M |
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
| QA & Deployment Engineer | Merge into main → `deploy.sh sync main / build` → `db-status / db-backup / db-migrate` → `up / health` → e2e → hand off for human acceptance | [deployment.md](deployment.md) |
