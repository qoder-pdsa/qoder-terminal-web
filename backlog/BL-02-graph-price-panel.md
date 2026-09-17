# BL-02 · GP Price Chart Panel

Typing `700 GP` shows daily candlesticks with SMA20 / SMA50 overlays.

## BL-02-1 · web: candlestick chart panel
- **Repo**: qoder-terminal-web
- **Depends on**: none (data already provides `/v1/history` and `/v1/indicators`)
- [ ] Add `GraphPanel.tsx` and replace the placeholder in `registry.tsx`; choose a chart library and explain why (lightweight-charts suggested)
- [ ] Support a range argument such as `700 GP 6M` (with parse unit tests)
- [ ] Price strings are converted only when handed to the chart library, in a single unit-tested function
- [ ] Up/down colors are switchable CSS variables (default red-up/green-down for mainland audiences; HKEX convention is green-up/red-down)
- [ ] loading / error / empty states; `data-testid="graph-panel"`
- [ ] e2e: the chart canvas is visible after `700 GP`
