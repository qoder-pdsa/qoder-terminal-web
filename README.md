# qoder-terminal-web

The **Bloomberg-style frontend** (TypeScript + React + Vite) for Qoder Terminal, and the **entry-point repo** of the project:
it holds the cross-repo e2e tests, docker-compose, design docs, and backlog.

## Project overview

| Repo | Language | Responsibility | Port |
|---|---|---|---|
| `qoder-terminal-data` | Go | Hong Kong quotes / candlesticks / news / indicators (mock or Longbridge) | 8081 |
| `qoder-terminal-analyst` | Python | AI analyst (`ASK`) | 8082 |
| `qoder-terminal-user` | Java | Login, JWT, user activity history (PostgreSQL) | 8084 |
| **`qoder-terminal-web`** (this repo) | TypeScript | Terminal UI + e2e + orchestration | 5173 |

The four repos must be sibling directories:

```bash
mkdir qoder-terminal && cd qoder-terminal
for r in data analyst user web; do git clone git@github.com:qoder-pdsa/qoder-terminal-$r.git; done
```

## Quick start

```bash
make install
./scripts/dev.sh                              # start data + analyst + web (mock data)
DATA_PROVIDER=longbridge ./scripts/dev.sh     # live Hong Kong market data
make e2e-api && make e2e-ui                   # end-to-end tests once services are up
./scripts/test-all.sh                         # lint + tests for all four repos
docker compose up --build                     # includes PostgreSQL and user (runs migrations automatically, local only)
```

## Command bar

| Input | Panel | Status |
|---|---|---|
| `700 Q` / `0700.HK Q` | Quote | ✅ |
| `ASK compare Tencent and Alibaba` | AI analyst (streams tool calls, opens panels automatically) | ✅ |
| `700 GP` / `700 GP 6M` | Candlesticks + `1M` / `3M` / `6M` / `1Y` range buttons + SMA20 / SMA50 toggles | ✅ |
| `N` / `700 N` | News for one symbol, or the first watchlist group merged and de-duplicated | ✅ |
| `W` | Watchlist groups (the Longbridge account's; mock has one demo group) with prices polled every 5 s; click a row for `Q` | ✅ |
| `700 CF` | Intraday capital flow: net inflow per minute + large / medium / small order distribution | ✅ |
| `CLEAR` | Empties the grid; every open panel header also has a `×` that closes just that panel | ✅ |

Environment variables: `VITE_DATA_URL` (default `http://localhost:8081`) and `VITE_ANALYST_URL` (default `http://localhost:8082`).

## Docs
- [Production deployment](docs/deployment.md)
- [Architecture](docs/architecture.md) · [AutoWonder workflow](docs/autowonder-workflow.md) · [Demo script](docs/demo-script.md) · [Backlog](backlog/README.md)
- Shared delivery rules: [`shared-rules/`](shared-rules/); run `scripts/sync-rules.sh` after editing
