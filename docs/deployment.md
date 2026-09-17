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
| Sync candidate version | `deploy.sh sync <branch>` | Branch merge and deployment preparation |
| Build images | `deploy.sh build` | Branch merge and deployment preparation (build before database writes) |
| Migration status | `deploy.sh db-status` | Database change pre-check |
| Backup | `deploy.sh db-backup` | Database change execution (before executing) |
| Migrate | `deploy.sh db-migrate` | Database change execution |
| Start | `deploy.sh up` | Application deployment (no build, no migration) |
| Health check | `deploy.sh health` | Application deployment and health check |
| Post-deployment tests | web repo `e2e` with `WEB_URL=http://<public IP>` etc. | Post-deployment tests |
| View logs | `deploy.sh logs <service>` | Failure attribution |

## Executor access

The executor user `qoderworker` deploys over the private network with `ssh qoder-terminal-app deploy.sh <subcommand>`.
The `qtdeploy` authorized_keys entry on the deployment host uses the forced command `deploy/ssh-gate.sh` (installed as `/usr/local/bin/qt-ssh-gate`),
which only allows allowlisted deploy.sh subcommands, with no shell and no port forwarding.

Services never migrate the database on startup; migrations only run via `db-migrate`.
