---
name: qoder-terminal-web
description: Use when implementing or reviewing a change in qoder-terminal-web (React 19 + Vite + lightweight-charts) — panel architecture, how to add a function code, decimal and test-id conventions, vitest and Playwright patterns, branch previews.
---

# qoder-terminal-web

The terminal UI: a command bar (`700 Q`, `9988.HK GP 6M`, `N`, `W`, `700 CF`, `ASK …`) above a fixed 2×2 grid of panels.
Read `AGENTS.md` in the repo; this skill is the practical map.

## Map

```
src/commands/parse.ts        FUNCTION_CODES, parseCommand(), normalizeSymbol()  — pure, unit-tested
src/commands/history.ts      ↑/↓ recall (immutable state)
src/layout/slots.ts          2×2 grid: newest panel first, oldest dropped
src/panels/registry.tsx      function code → <Panel>, panelTitle()   ← the only wiring point
src/panels/*Panel.tsx        one file per panel; owns fetch + loading/error/empty states
src/panels/*Data.ts / *State.ts / *Format.ts   pure helpers next to their panel, always unit-tested
src/panels/chartTheme.ts     readChartTheme() + createTerminalChart() — every chart uses these
src/api/data.ts, analyst.ts  contract types + fetch functions; components never call fetch() directly
src/styles.css               all colors are CSS variables here; nothing hard-coded in components
e2e/tests/*.ui.spec.ts       Playwright user flows;  *.api.spec.ts  contract checks against the data/analyst services
```

Existing panels to copy from: `QuotePanel` (poll every 10 s + baseline chart), `GraphPanel` (candles + SMA toggles),
`NewsPanel` (list + merged feeds), `WatchlistPanel` (batch quotes poll + row click), `CapitalFlowPanel` (histogram + table).

## Adding a function code (e.g. `XX`)

1. Contract: confirm the endpoint exists in `../qoder-terminal-data/api/openapi.yaml`; add the mirrored type + `fetchXx()` in `src/api/data.ts`.
2. `parse.ts`: add `"XX"` to `FUNCTION_CODES`; add it to `REQUIRES_SYMBOL` if it needs one. Update `parse.test.ts` (parses + rejects cases).
3. Pure helper `src/panels/xxData.ts` with tests first (decimal → number conversion lives **only** here).
4. `XxPanel.tsx`: `useEffect` with `AbortController`, `State = loading | error | ok (| empty)`, `data-testid` on the panel and on anything a test touches.
5. `registry.tsx`: one new `case`. `App.tsx`: add the code to the top-bar hint.
6. `e2e/tests/terminal.ui.spec.ts`: one flow using the `run(page, "700 XX")` helper; assert on `data-testid`, never `waitForTimeout`.
7. `README.md` command table.

## Conventions that reviewers check

- Prices/amounts render as the contract strings. Comparison → `compareDecimal` (`watchlistState.ts`); rounding → `roundDecimalString` (`quoteFormat.ts`); chart numbers → the panel's `*Data.ts`.
- Colors only via `var(--…)`; charts read them with `readChartTheme()` because canvas cannot use `var()`.
- Time: `formatHkTime()` for the header clock; chart axes use `exchangeTimeZone(symbol)` + `formatClock()` (`capitalFlowData.ts`) so HK/US/CN symbols show their own exchange clock.
- Polling panels (`Q`, `W`) keep the last good data on a failed refresh and clear the interval on unmount.
- Immutable state updates (`{ ...prev, … }`), no mutation of props or cached arrays.
- Empty states are explicit: pre-open live data returns empty arrays (`intraday.points`, `capital-flow.flow`) — render a message, not an error.

## Testing

- Unit: `npx vitest run` (or `make test`, which also runs `deploy/preview-lib.test.sh`). Table-driven `it.each` is the house style.
- Type check is the lint: `make lint` = `tsc -b --noEmit && tsc -p e2e/tsconfig.json`.
- e2e needs the stack: `./scripts/dev.sh` (mock data) then `make e2e-ui` / `make e2e-api`; both projects: `npx playwright test -c e2e/playwright.config.ts --project=api --project=ui`.
- Against a preview or production: `WEB_URL=https://qoder.live/preview/<slug>/ DATA_URL=https://qoder.live/api/data ANALYST_URL=https://qoder.live/api/analyst PREVIEW_SLUG=<slug> npx playwright test …`.
- Mock data is deterministic but synthetic (six HK symbols). Real Longbridge data differs: watchlists contain US stocks and 20-char option symbols, news can be all-US, intraday/capital-flow are empty before 09:30 HKT. Don't write HK-only assertions.

## Branch previews (frontend-only work)

`ssh qoder-terminal-app deploy.sh preview <branch>` builds the branch with `vite build --base=/preview/<slug>/` and serves it at
`https://qoder.live/preview/<slug>/` against the **production backend** (so backend changes are invisible in a preview).
Slug = branch without `feature/`/`fix/`, lowercased, non-alphanumerics → `-`, max 40 chars. Put the URL first in the review handoff.
