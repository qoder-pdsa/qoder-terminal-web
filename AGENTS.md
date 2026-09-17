# qoder-terminal-web — Agent Guide

TypeScript + React 19 + Vite. **Consumer repo** of:
- the data contract `../qoder-terminal-data/api/openapi.yaml`
- the analyst contract `../qoder-terminal-analyst/api/openapi.yaml` and `agent-event.schema.json`
- the user contract `../qoder-terminal-user/api/openapi.yaml`

It is also the project entry point: `e2e/`, `docker-compose.yml`, `docs/`, `backlog/`, `shared-rules/`.

## Architecture
- `src/commands/parse.ts` — command parsing and symbol normalization (pure functions, must be unit tested)
- `src/panels/registry.tsx` — function code → panel; **adding a panel only touches this file plus a new panel file**
- `src/layout/slots.ts` — fixed 2x2 grid: new panels go first, the oldest is dropped beyond 4, empty slots show a hint
- `src/panels/*Panel.tsx` — one file per panel, each owning its data fetching and loading / error / empty states
- `src/api/` — service calls and contract types; components never call `fetch` directly
- `e2e/` — Playwright: `*.api.spec.ts` for contracts and integration, `*.ui.spec.ts` for user flows

## Rules
- Never use fields that are not in the contracts; request missing fields in the provider repo first.
- Prices are displayed as strings and **never computed with `parseFloat`**; when a chart library needs numbers, convert in a single function.
- Hong Kong is the default market: bare numeric codes get `.HK`. Up/down colors only use the `--up` / `--down` variables (color scheme in BL-02).
- Visual style: black background, amber primary text, monospace font; colors only come from CSS variables in `styles.css`.
- Interactive elements carry `data-testid`; e2e tests must not use `waitForTimeout`, and zero tests or all-skipped runs do not count as passing.
- Run `scripts/sync-rules.sh` after editing `shared-rules/`.

## Commands
- `make test` / `make lint` / `make build` / `make dev`
- `make e2e-api` / `make e2e-ui` (start `./scripts/dev.sh` first)
