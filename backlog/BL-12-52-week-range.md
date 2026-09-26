# BL-12 · Q panel shows the 52-week high / low

| Work item | Repo | Depends on | Scope |
|---|---|---|---|
| BL-12-1 | data | none | Contract: `Quote` gains `high52w`, `low52w` (Decimal); longbridge maps `SecurityCalcIndex` (`CalcIndex` API) or derives from the 1Y daily candles when the calc index is unavailable; mock derives from its own history |
| BL-12-2 | web | BL-12-1 | Q panel head shows `52W 380.20 – 486.40` with a thin range bar marking where the last price sits |

- **Squad**: Standard Automated Delivery — provider first, same shape as BL-11.

## Background
After BL-11 the Q head shows the session's O/H/L/V. The next thing a trader looks for is where today's price sits in the
year's range. Longbridge exposes 52-week high/low on its calc-index endpoint; if that call is rate-limited or missing,
the 1Y candles the service already caches give the same numbers.

## Acceptance criteria
- [ ] `openapi.yaml`: `Quote` adds required `high52w`, `low52w` (`Decimal`); `make lint-api`; both quote routes carry them
- [ ] longbridge: one extra upstream call per quote at most, shared through `provider.Cached` with a 10-minute TTL keyed by symbol; fallback to the 1Y history max/min when the calc index errors, recorded in a comment and pinned by a fake test
- [ ] mock: `low52w ≤ low ≤ high ≤ high52w` for every known symbol (table-driven)
- [ ] web: `data-testid="quote-52w"` text `52W <low> – <high>` and a `data-testid="quote-52w-bar"` element whose `aria-valuenow` is the last price's position 0–100 (integer, computed with `compareDecimal`-safe integer arithmetic on the contract's 4-dp units, never floats)
- [ ] Unit tests both sides; contract e2e for the two fields; UI e2e `700 Q` shows `quote-52w` matching `/^52W \d+\.\d{4} – \d+\.\d{4}$/`
- [ ] `make lint test` passes in both repos

## Out of scope
All-time high/low, W panel columns.
