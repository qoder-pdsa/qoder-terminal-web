# BL-01 · EMA and RSI Indicators

- **Repo**: qoder-terminal-data
- **Depends on**: none
- **Squad**: Standard Automated Delivery

## Acceptance criteria
- [ ] Contract: add `ema` and `rsi` to the `kind` enum of `/v1/indicators/{symbol}`
- [ ] `indicators.EMA`: the first valid value is the SMA of the first `window` closes, then recurses with `k = 2/(window+1)`
- [ ] `indicators.RSI`: Wilder smoothing, nil for the first `window` positions, values within 0–100; the convention when all closes are equal is documented in a comment and tested
- [ ] Table-driven tests cover empty input, window > len, and window = 1
- [ ] `money.Decimal` throughout with no float64; `make lint test` passes
