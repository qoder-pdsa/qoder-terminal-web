# DEMO · Fast-track work items for live demos

Small, visible, frontend-only changes that fit the **Demo Fast Track** SDLC (10003). Paste one as a TASK work item and
assign it to the Full-Stack Developer with `sdlcId: 10003`.

## DEMO-1 · Q panel shows the day's range
- **Repo**: qoder-terminal-web (frontend only; `/v1/quotes/{symbol}` already returns `open`, `high`, `low`, `prevClose`)
- Goal: the quote panel (`700 Q`) shows a `Day range: <low> – <high>` line under the price, values as returned by the API (decimal strings, no arithmetic).
- [ ] `QuotePanel.tsx` renders `data-testid="quote-range"` with `low – high`; hidden when either field is missing
- [ ] Unit test for the formatting helper (no floats; strings passed through)
- [ ] UI e2e: after `700 Q`, `quote-range` is visible and matches `/\d+\.\d{4} – \d+\.\d{4}/`
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
