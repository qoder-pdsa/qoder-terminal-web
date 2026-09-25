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
- Goal: every open panel header gets a small `×` on the right that closes just that panel; typing `CLEAR` in the command bar closes all panels. Accepted 2026-09-25 as delivered: closing a panel compacts the grid (remaining panels keep their newest-first order and move up), which is the existing slot model. `CLEAR` is a function code like `N` / `W` (no symbol), listed in the top-bar hint.
- [ ] `src/layout/slots.ts` gains pure, unit-tested `closePanel(prev, id)` (immutable, order of the remaining panels unchanged) and the `CLEAR` handling stays in `App.tsx`/`parse.ts` — `parseCommand("clear")` yields `{ kind: "function", code: "CLEAR" }` and `"700 CLEAR"` is rejected
- [ ] The `×` has `data-testid="close-panel"` and `aria-label="Close <title>"`; closing a polling panel (`Q`, `W`) must stop its interval (existing `useEffect` cleanup)
- [ ] UI e2e: open `700 Q` and `9988 Q`, click the first `close-panel`, expect one `quote-panel` left and three `empty-slot`; then `CLEAR` → four `empty-slot`
- [ ] `make lint test` passes
- Out of scope: drag/reorder, keyboard shortcuts, remembering closed panels

## DEMO-6 · W panel: sort by price or change
- **Repo**: qoder-terminal-web (frontend only)
- Goal: the `W` panel's `PRICE` and `CHANGE` column headers become clickable; the first click sorts descending, the second ascending, a click on the other header switches the key. The active header shows `▼` / `▲`; with no sort the rows keep the watchlist's own order. Sorting is per panel and survives the 5 s quote refresh (rows re-sort as prices move). Rows whose quote is still `…` (no quote, e.g. options) sort last in either direction.
- [ ] Pure, unit-tested `sortRows(rows, sort)` next to `watchlistState.ts`; immutable; ties keep the original order (stable); comparisons of price / change / changePercent follow the project rule — contract decimal strings are compared with `compareDecimal`, never converted with `Number()` / `parseFloat`
- [ ] Headers have `data-testid="sort-price"` / `sort-change"` and `aria-sort="descending|ascending|none"`; the sort key is `changePercent` for the CHANGE column
- [ ] UI e2e: after `W`, clicking `sort-change` makes the first row's `watchlist-change` the largest percentage of the visible rows and sets `aria-sort="descending"`; a second click flips it
- [ ] `make lint test` passes
- Out of scope: sorting by name/symbol, persisting the sort, multi-column sort

## DEMO-7 · Command bar: Tab completion
- **Repo**: qoder-terminal-web (frontend only)
- Goal: pressing `Tab` in the command bar completes the token under the cursor. A first token completes to a **symbol used earlier in this session** (from the command history, most recent first, e.g. `70` → `700.HK`) or to a function code without symbol (`N`, `W`, `CLEAR`); a second token completes to a function code (`700 G` → `700 GP`). Repeated `Tab` cycles through the candidates; `Shift+Tab` cycles backwards; the completed input is placed with the cursor at the end. **Change request at acceptance (2026-09-25):** a first token that completes to a symbol gets one trailing space (`9` → `9988.HK `) so the next `Tab` goes straight to the function code; a first token that completes to a symbol-less code (`N`, `W`, `CLEAR`) gets none; cycling keeps working with the space present. `Tab` with no candidates does nothing (focus stays in the input). ↑ / ↓ history recall keeps working exactly as today.
- [ ] Pure, unit-tested `complete(input, candidates, cycle)` in `src/commands/complete.ts` (case-insensitive prefix match, candidates de-duplicated, immutable); candidates come from `FUNCTION_CODES` and the symbols found in `HistoryState.entries`
- [ ] The input keeps `data-testid="command-input"`; the current candidate list is exposed as `data-completions="700.HK,700 GP"` (comma-separated) on the input for tests, empty when none
- [x] UI e2e: run `700 Q`, type `70`, press `Tab` → input is `700.HK ` (trailing space); type `G`, press `Tab` → `700.HK GP`; ↑ still recalls `700 Q` — accepted 2026-09-25 after one rework round
- [ ] `make lint test` passes
- Out of scope: a visual dropdown, completing ranges, fuzzy matching, company names

## DEMO-8 · GP panel: volume bars
- **Repo**: qoder-terminal-web (frontend only; `/v1/history` candles already carry `volume`)
- Goal: the candlestick chart gets a volume histogram in its own pane at the bottom (about a quarter of the chart height), one bar per candle, colored with the candle's up/down color (`--candle-up` when close ≥ open, `--candle-down` otherwise), so a trader can see whether a move came with volume. The SMA toggles and range buttons keep working; the histogram follows the same range.
- [ ] Pure, unit-tested mapping in `chartData.ts` (`ChartData` gains `volume: { time, value, color }[]`); the color decision is a pure function; `volume` stays an integer (no decimal conversion involved)
- [x] Rendered with lightweight-charts `HistogramSeries` in a **real second pane** (`chart.addSeries(HistogramSeries, opts, 1)`, pane sized to about a quarter), so the candle price axis stops at the candles; no extra fetch. *(Corrected at acceptance 2026-09-25: the first delivery used a `scaleMargins` overlay as the original bullet said, but the price axis then ran under the bars — rejected, brief was self-contradictory.)*
- [x] `data-testid="graph-chart"` unchanged; the pane count is exposed as `data-panes` on the chart container, **derived from `chart.panes().length` after mount** (not a constant), so the e2e asserts the real pane
- [x] UI e2e: after `700 GP`, `graph-chart` has `data-panes="2"` and the canvas is visible; toggling `range-1M` keeps `data-panes="2"` — accepted 2026-09-26 after one rework round
- [ ] `make lint test` passes
- Out of scope: volume moving averages, a toggle to hide the volume pane, intraday (Q) volume

## DEMO-9 · GP panel: crosshair readout
- **Repo**: qoder-terminal-web (frontend only)
- Goal: while the mouse hovers over the candlestick chart, a readout line under the panel toolbar shows the hovered candle: `2026-09-22  O 431.6000  H 437.2000  L 430.8000  C 436.6000  V 9.11M`, with the `C` value colored by the candle's direction (`--candle-up` / `--candle-down`). When the mouse leaves the chart the readout shows the **last** candle instead, so the line is never empty once data is loaded. The SMA toggles, range buttons and volume pane are unchanged.
- [ ] Pure, unit-tested `formatCandleReadout(candle)` next to `chartData.ts`: date as `YYYY-MM-DD`, prices passed through as the contract's decimal strings (no `Number()` on prices), volume via `formatAmount`; direction via `compareDecimal(close, open)`
- [ ] Wired with lightweight-charts `chart.subscribeCrosshairMove` (the candle series' data for `param.time`; `param.time` undefined ⇒ last candle); the subscription is removed on unmount / chart re-create
- [ ] Readout element has `data-testid="candle-readout"` and `data-direction="up|down|flat"`; it never triggers a refetch
- [x] UI e2e: after `700 GP`, `candle-readout` matches `/^\d{4}-\d{2}-\d{2}\s+O \d+\.\d{4}\s+H \d+\.\d{4}\s+L \d+\.\d{4}\s+C \d+\.\d{4}\s+V \S+$/`; hovering over the chart canvas at its left edge changes the date shown (compare before/after)
- [ ] `make lint test` passes
- Out of scope: readout for the intraday (Q) chart, SMA values in the readout, touch devices
- Accepted 2026-09-26.
