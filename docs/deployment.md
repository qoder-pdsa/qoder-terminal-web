# Production Deployment (Alibaba Cloud Hong Kong)

## Topology

| Instance | Role |
|---|---|
| `qoder-wonder-260917-app` | qoder-wonder (AutoWonder) platform |
| `qoder-wonder-260917-executor` | Digital worker executors; QA deploys over private-network SSH |
| `qoder-terminal-app` | Qoder Terminal: postgres + user + data + analyst + web (docker compose) |

Browsers only reach `qoder-terminal-app:80`, where the nginx gateway inside the web container routes requests:

| Path | Routed to |
|---|---|
| `/` | Frontend static files |
| `/api/data/` | data:8081 |
| `/api/analyst/` | analyst:8082 (SSE, buffering disabled) |
| `/api/user/` | user:8084 |
| `/healthz` | The gateway itself |

## Directories and credentials

```
/opt/qoder-terminal/src/<four repos>    # deployment checkouts (read-only, never edit by hand)
/opt/qoder-terminal/backups/            # database backups (700)
/etc/qoder-terminal/qoder-terminal.env  # credentials (600, never committed); format in deploy/qoder-terminal.env.example
```

## Deployment steps (`deploy/deploy.sh`, called step by step by the AutoWonder QA digital worker)

| Step | Command | QA SDLC step |
|---|---|---|
| Sync candidate version | `deploy.sh sync <branch>` | Delivery intake and deployment preparation |
| Build images | `deploy.sh build` | Branch merge and deployment preparation (build before database writes) |
| Migration status | `deploy.sh db-status` | Database change pre-check |
| Backup | `deploy.sh db-backup` | Database change execution (before executing) |
| Migrate | `deploy.sh db-migrate` | Database change execution |
| Start | `deploy.sh up` | Application deployment (no build, no migration) |
| Health check | `deploy.sh health` | Application deployment and health check |
| Post-deployment tests | web repo `e2e` with `WEB_URL=http://<public IP>` etc. | Post-deployment tests |
| View logs | `deploy.sh logs <service>` | Failure attribution |
| Publish a branch preview | `deploy.sh preview <branch>` | Deployment and health check (frontend-only changes) |
| List / remove previews | `deploy.sh preview-ls`, `deploy.sh preview-rm <slug>` | Housekeeping |

## Executor access

The executor user `qoderworker` deploys over the private network with `ssh qoder-terminal-app deploy.sh <subcommand>`.
The `qtdeploy` authorized_keys entry on the deployment host uses the forced command `deploy/ssh-gate.sh` (installed as `/usr/local/bin/qt-ssh-gate`),
which only allows allowlisted deploy.sh subcommands, with no shell and no port forwarding.

Services never migrate the database on startup; migrations only run via `db-migrate`.

## Branch policy

`deploy.sh sync <branch>` checks out `origin/<branch>` in every repo that has it and `origin/main` everywhere else,
so a feature branch that exists in one repo can be deployed without touching the others.
QA deploys the **reviewed feature branch** directly; `main` is fast-forwarded by a human after acceptance,
because the runtime policy on the executors refuses pushes to `main`.

## Per-branch frontend previews

`deploy.sh preview <branch>` gives a work item its own URL without touching production, the way Vercel/Railway
preview deployments do:

```
deploy.sh preview feature/bl02-graph-price-panel-20260918123222
→ http://47.242.87.16/preview/bl02-graph-price-panel-20260918123222/
```

- **Slug**: the branch name without its type prefix (`feature/`, `fix/`), lowercased, runs of anything outside
  `[a-z0-9]` replaced by one dash, truncated to 40 characters (`deploy/preview-lib.sh`, unit-tested).
- **Build**: a clean `git archive` of `origin/<branch>` is built in Docker with `VITE_BASE=/preview/<slug>/`; the
  production checkout and images are never touched. The bundle lands in `/opt/qoder-terminal/previews/<slug>/`
  (atomic replace), which the web container mounts read-only at `/usr/share/nginx/preview`.
- **Routing**: nginx serves `/preview/<slug>/` with SPA fallback to that preview's own `index.html`; `index.html` is
  `no-cache`, hashed assets are immutable; an unknown slug is a 404. `/` stays the production bundle.
- **Shared backend**: a preview calls the same `/api/data`, `/api/analyst`, `/api/user` as production. Previews therefore
  only show **frontend** changes; a branch that changes a backend contract still needs the production deployment.
- **Retention**: at most 10 previews, none older than 7 days; both enforced on every `preview` run. `preview-ls` shows
  slug, branch, commit, build time and size; `preview-rm <slug>` removes one (non-zero exit when it does not exist).
- **Verification**: `PREVIEW_SLUG=<slug> WEB_URL=... DATA_URL=... npx playwright test -c e2e/playwright.config.ts --project=api`
  runs `e2e/tests/preview.api.spec.ts` (skipped when `PREVIEW_SLUG` is unset).
- **Release**: once a human accepts the preview, `main` is fast-forwarded and production is updated with
  `deploy.sh sync main` → `build` → `up` → `health`.
