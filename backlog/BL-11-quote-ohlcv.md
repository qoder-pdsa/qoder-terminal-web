# BL-11 · Q panel shows open / high / low / volume

| Work item | Repo | Depends on | Scope |
|---|---|---|---|
| BL-11-1 | data | none | Contract: `Quote` gains `open`, `high`, `low` (Decimal), `volume` (int64), `turnover` (Decimal); longbridge maps `SecurityQuote.Open/High/Low/Volume/Turnover`; mock derives deterministic values |
| BL-11-2 | web | BL-11-1 | The Q panel head shows `O 431.60  H 436.20  L 430.80  VOL 12.3M` under the price line; the W panel is unchanged |

- **Squad**: Standard Automated Delivery — one work item covering both repos, **provider first**: the data change (contract + `make lint-api` + provider + handler + tests) is committed and pushed before the web change; the web branch consumes the new fields only after the data branch exists on origin.

## Background
The Q panel shows last price, change and an intraday line, but a trader also expects the session's open/high/low and volume at a glance. Longbridge already returns them on the same quote call, so this is a contract extension without any new upstream request.

## Acceptance criteria
- [ ] `qoder-terminal-data/api/openapi.yaml`: `Quote` adds required `open`, `high`, `low`, `turnover` (`Decimal`) and `volume` (integer int64); `make lint-api` passes; `/v1/quotes/{symbol}` and the batch `/v1/quotes?symbols=` both carry them
- [ ] longbridge: mapped through `toMoney`; a quote whose `Open` is nil before the session starts yields `"0.0000"`-free output — use the previous close for open/high/low and `0` volume, documented in a comment and pinned by a fake-based test
- [ ] mock: deterministic values with `low ≤ open, close ≤ high` for every known symbol (table-driven test)
- [ ] web `src/api/data.ts` mirrors the contract; `QuotePanel` renders `data-testid="quote-ohlc"` with `O … H … L …` and `data-testid="quote-volume"` with the volume formatted by `formatAmount` (`12.3M`); strings displayed as-is, no arithmetic
- [ ] Unit tests for the mock invariants (data) and for a pure `formatOhlc` helper (web); e2e contract case checks the five new fields are present and decimal-shaped; UI e2e: after `700 Q`, `quote-ohlc` matches `/^O \d+\.\d{4}\s+H \d+\.\d{4}\s+L \d+\.\d{4}$/`
- [ ] `make lint test` passes in both repos

**Delivered 2026-09-26** (data `b7d90f8`, web `6346613`; merged as `main` web merge commit). QA deployed the web branch while it was 7 commits behind `main`, which briefly removed TD-02 / DEMO-8 from production until the human release — the deploy skill now hard-gates on `merge-base --is-ancestor`.

## Out of scope
52-week high/low, bid/ask, W panel columns, analyst summary changes.
