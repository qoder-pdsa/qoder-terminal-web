---
name: qoder-terminal-data
description: Use when implementing or reviewing a change in qoder-terminal-data (Go) — contract-first endpoints, the Provider interface and its Longbridge/mock implementations, money.Decimal, the flight cache, and the real-world Longbridge behaviours that mock data hides.
---

# qoder-terminal-data

Go market-data service; **owner of `api/openapi.yaml`**, consumed by analyst and web. Read `AGENTS.md`; this skill is the practical map.

## Map

```
cmd/server/main.go            DATA_PROVIDER=mock|longbridge, wraps the provider in provider.NewCached(p, 60s, 10s)
internal/api/handlers.go      routes + JSON shaping; symbolPattern; providerError() maps ErrNotFound→404, ErrSymbolRequired→400, else 502
internal/provider/provider.go Provider interface + domain types (Quote, Candle, NewsItem, Watchlist, CapitalFlow, Intraday)
internal/provider/mock.go     deterministic offline data (six HK symbols, seeded by symbol)
internal/provider/longbridge.go  the only file that imports the Longbridge SDK, behind the quoteAPI / newsAPI interfaces
internal/provider/cache.go    flightCache[K,V]: coalesces concurrent identical fetches, TTL per data kind, never caches errors
internal/money/decimal.go     fixed-point (4 dp) Decimal: Parse, FromUnits, Add/Sub/MulInt/DivInt/PercentOf, String
internal/indicators/          SMA/EMA/RSI as pure functions over []money.Decimal
api/openapi.yaml              the contract; `make lint-api` (redocly) must pass
```

Endpoints: `/v1/quotes/{symbol}`, `/v1/quotes?symbols=a,b` (batch, ≤20, unquotable symbols omitted), `/v1/history/{symbol}?range=1M|3M|6M|1Y`,
`/v1/indicators/{symbol}?kind=sma|ema|rsi&window=`, `/v1/news?symbol=&limit=`, `/v1/watchlists`, `/v1/capital-flow/{symbol}`, `/v1/intraday/{symbol}`.

## Adding an endpoint

1. `api/openapi.yaml` first (path + schema; every amount is `Decimal`, times are RFC 3339 UTC). `make lint-api`.
2. `provider.go`: domain type + method on the `Provider` interface.
3. Tests first: `mock_*_test.go` (determinism, ordering, empty cases), `longbridge_*_test.go` using the `fakeQuotes` fake (extend it with the new SDK method), `handlers_*_test.go` (status table + JSON shape, `[]` not `null` for empty arrays).
4. `mock.go` (seeded, deterministic, exercises both signs/branches), `longbridge.go` (add the SDK method to `quoteAPI`), `handlers.go` (route + body builder).
5. If the data is polled or requested in bursts, add it to `Cached` with a TTL; write the coalescing test.
6. `README.md` providers table; `make lint test`.

## Rules the reviewer enforces

- **No float64 on prices.** `toMoney(*decimal.Decimal)` → `money.Decimal`; arithmetic (change, percent, net = in − out) happens server-side in `money`.
- `ErrNotFound` only when the symbol really does not exist. **Empty is not missing**: an empty intraday line or capital flow before the first trade is a 200 with `[]`.
- Errors wrap with context (`fmt.Errorf("longbridge intraday %s: %w", symbol, err)`); clients only ever see `{"code","message"}`.
- Slices returned from the cache are copies; handlers never mutate provider data.
- `symbolPattern` is `^[0-9A-Z]{1,20}\.(HK|US|SH|SZ)$` — keep it identical in `openapi.yaml`, `handlers.go` and web's `parse.ts`.
- Time zones: daily candles are UTC midnight of the exchange trading day (`exchangeLocation`); minute data is the real UTC timestamp.

## Longbridge reality (what the mock will not show you)

- **Rate limit** (`code:301606 request rate limit`): the candlestick endpoint rejects bursts. One GP panel = history + 2 indicators = 3 calls; `ASK compare` opens two panels. That is why `Cached` exists — never add a per-request upstream call for data another request already fetched.
- **Watchlists are the account's real groups**: mostly US stocks, empty groups, negative ids (`holdings` = -6), option symbols like `MSFT261016P420000.US`. The securities `Quote` call returns nothing for options → batch quotes must skip them, not fail.
- **Pre-open**: `Intraday` and `CapitalFlow` return zero lines until the first trade (09:30 HKT); `CapitalDistribution` still answers.
- Quote timestamps are seconds; `time.Unix(ts, 0).UTC()`.
- Credentials: `LONGBRIDGE_APP_KEY/APP_SECRET/ACCESS_TOKEN` from env; the SDK needs `HTTPS_PROXY` on machines behind a local proxy. Unit tests never touch the network — use the fakes.

## Commands

`make test` · `make lint` (vet + gofmt + `lint-api`) · `make dev` (mock, :8081) · `make dev-live` (Longbridge). Race detector: `go test -race ./...`.
