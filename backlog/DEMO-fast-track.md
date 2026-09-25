# DEMO · Fast-track work items for live demos

Small, visible, frontend-only changes that fit the **Demo Fast Track** SDLC (10003). Paste one as a TASK work item and
assign it to the Full-Stack Developer with `sdlcId: 10003`.

## DEMO-1 · Q panel: colored change and Hong Kong time
- **Repo**: qoder-terminal-web (frontend only; `/v1/quotes/{symbol}` returns `price`, `change`, `changePercent`, `asOf`)
- Goal: the quote panel (`700 Q`) shows the change as `▲ +7.0000 (+1.64%)` / `▼ -7.0000 (-1.64%)` colored with the existing `--candle-up` / `--candle-down` CSS variables, and `asOf` as `HH:mm HKT`.
- [ ] Pure, unit-tested `formatChange(change, changePercent)` and `formatHkTime(asOf)` in `src/panels/quoteFormat.ts`; strings are passed through, no float arithmetic
- [ ] `QuotePanel.tsx` renders `data-testid="quote-change"` (with `data-direction="up|down|flat"`) and `data-testid="quote-asof"`
- [ ] UI e2e: after `700 Q`, `quote-change` is visible and starts with `▲` or `▼`
- [ ] `make lint test` passes

## DEMO-2 · GP panel: toggle SMA overlays
- **Repo**: qoder-terminal-web
- Goal: two small buttons `SMA20` / `SMA50` in the graph panel header toggle each overlay; state is per panel.
- [ ] Buttons have `data-testid="toggle-sma20"` / `toggle-sma50"` and `aria-pressed`
- [ ] Unit test for the toggle reducer (immutable state)
- [ ] UI e2e: after `700 GP`, clicking `toggle-sma20` flips `aria-pressed`
- [ ] `make lint test` passes

## DEMO-3 · Command bar history
- **Repo**: qoder-terminal-web
- Goal: ↑ / ↓ in the command bar recall the last 20 commands of this session (in-memory only).
- [ ] Pure `history.ts` with `push`/`back`/`forward`, unit-tested, capped at 20, no duplicates of the latest entry
- [ ] UI e2e: type `700 Q`, then ↑ restores `700 Q` in the input
- [ ] `make lint test` passes

## DEMO-4 · GP panel: range buttons
- **Repo**: qoder-terminal-web (frontend only; `/v1/history/{symbol}?range=` and `/v1/indicators/{symbol}?range=` already accept `1M|3M|6M|1Y`)
- Goal: the graph panel header gets four small buttons `1M` `3M` `6M` `1Y` next to the SMA toggles; clicking one refetches the candles and SMA series for that range and updates the panel heading (`700.HK GP 6M`). State is per panel; the initial value is the range the command was opened with (`700 GP 6M` starts on `6M`).
- [ ] Buttons have `data-testid="range-1M"` … `range-1Y"` and `aria-pressed` on the active one; reuse the `.graph-toolbar` button style
- [ ] The range list comes from `HISTORY_RANGES` in `src/api/data.ts` — no second copy of the enum
- [ ] Pure, unit-tested state helper (immutable) next to `overlayState.ts`; switching range must abort the in-flight fetch of the previous range
- [ ] UI e2e: after `700 GP`, clicking `range-1M` flips its `aria-pressed` to `true`, `range-3M` to `false`, and the canvas is still visible
- [ ] `make lint test` passes
- Out of scope: intraday/`Q` panel, new ranges, persisting the choice

## DEMO-5 · Close a panel and CLEAR the grid
- **Repo**: qoder-terminal-web (frontend only)
- Goal: every open panel header gets a small `×` on the right that closes just that panel (its slot becomes empty again, other panels keep their positions); typing `CLEAR` in the command bar closes all panels. `CLEAR` is a function code like `N` / `W` (no symbol), listed in the top-bar hint.
- [ ] `src/layout/slots.ts` gains pure, unit-tested `closePanel(prev, id)` (immutable, order of the remaining panels unchanged) and the `CLEAR` handling stays in `App.tsx`/`parse.ts` — `parseCommand("clear")` yields `{ kind: "function", code: "CLEAR" }` and `"700 CLEAR"` is rejected
- [ ] The `×` has `data-testid="close-panel"` and `aria-label="Close <title>"`; closing a polling panel (`Q`, `W`) must stop its interval (existing `useEffect` cleanup)
- [ ] UI e2e: open `700 Q` and `9988 Q`, click the first `close-panel`, expect one `quote-panel` left and three `empty-slot`; then `CLEAR` → four `empty-slot`
- [ ] `make lint test` passes
- Out of scope: drag/reorder, keyboard shortcuts, remembering closed panels
