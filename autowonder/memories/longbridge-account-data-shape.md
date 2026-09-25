---
title: Production Longbridge data looks nothing like the mock — plan for options, US groups and pre-open emptiness
type: DOMAIN
scope: ORG
---

## Fact

The production data service uses the project owner's real Longbridge account. Observed on 2026-09-25:

- `GET /v1/watchlists` returns six groups — `all` (19, mostly US: ORCL, ADBE, ARM, MSFT, SNDK …), `holdings` (id -6, empty), `us` (19), `hk` (empty), `options` (1), `期权` (3). Symbols include options such as `MSFT261016P420000.US` (20 characters).
- The securities `Quote` call returns nothing for option symbols; `GET /v1/quotes?symbols=` therefore omits them and the reply can be shorter than the request.
- `Intraday` and `CapitalFlow` return zero lines until the first trade of the HK session (09:30 HKT); `CapitalDistribution` still answers. The API returns `200` with empty arrays, not `404`.
- The candlestick endpoint rate-limits bursts (`code:301606 request rate limit`); the service coalesces and caches identical requests (`provider.Cached`).

The mock provider only knows six short HK codes with deterministic sawtooth data and never shows any of this.

## How to apply

- Symbol regex is `^[0-9A-Z]{1,20}\.(HK|US|SH|SZ)$` everywhere (contract, Go handler, web parser). Never reintroduce `{1,6}`.
- A UI or test that assumes "first watchlist group = Hong Kong stocks" or "news symbols match `\d+\.HK`" will fail on production. Assert on shape, not on market.
- Treat empty intraday/flow as a normal state with an empty-state message; verify live-data features after 09:30 HKT or accept the empty state.
