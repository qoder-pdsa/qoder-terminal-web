# BL-04 · Real-time Push and Watchlist

## BL-04-1 · data: WebSocket `/v1/stream`
- **Repo**: qoder-terminal-data
- **Depends on**: none
- [ ] Contract: add the `QuoteTick` event schema (draft in `api/quote-tick.schema.json`) and document `/v1/stream`
- [ ] Clients send `{"subscribe":["700.HK"]}`; the longbridge provider uses `Subscribe` + `OnQuote`, and mock generates deterministic ticks
- [ ] Release subscriptions on disconnect; respect Longbridge's 500-subscription limit

## BL-04-2 · data: watchlist groups
- **Repo**: qoder-terminal-data
- **Depends on**: none
- [x] `GET /v1/watchlists`: the longbridge provider reads `WatchedGroups` (the user's watchlist groups in the app) — shipped 2026-09-25, together with `GET /v1/quotes?symbols=` (batch, one upstream call)

## BL-04-3 · web: live Q updates + W watchlist panel
- **Repo**: qoder-terminal-web
- **Depends on**: BL-04-1, BL-04-2
- [ ] Briefly highlight price changes (reusing the up/down color variables); close the connection on unmount and reconnect with exponential backoff
- [x] The W panel shows groups with live prices — shipped 2026-09-25 with a 5 s batch-quote poll instead of the stream; switch to `/v1/stream` once BL-04-1 lands
