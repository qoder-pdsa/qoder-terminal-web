# BL-08 · N News Panel

- **Repo**: qoder-terminal-web
- **Depends on**: none
- **Squad**: Standard Automated Delivery

## Acceptance criteria
- [x] `700 N` shows news for the symbol (headline, source, relative time); clicking opens a new tab
- [x] `N` without a symbol shows combined news for watchlist symbols (the longbridge provider needs a symbol, so request each one, then merge and de-duplicate)
- [x] loading / error / empty states; e2e cases

Shipped 2026-09-25 (`src/panels/NewsPanel.tsx`). A bare `N` merges the first group of `GET /v1/watchlists` (max 6 symbols) and falls back to four default HK symbols when the watchlist is unavailable or empty.
