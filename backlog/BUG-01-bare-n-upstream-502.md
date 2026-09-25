# BUG-01 · bare `N` intermittently shows an upstream 502 for one symbol

- **Repo**: qoder-terminal-data (likely) / qoder-terminal-web (mitigation)
- **Depends on**: none
- **Squad**: Standard Automated Delivery
- **Origin**: seen twice by the Demo Developer while verifying DEMO-5 (Playwright 30/31 on the first run, clean on rerun)

## Root cause (QA, work item 10007, 2026-09-25)
Confirmed from the production data logs: the six parallel `/v1/news` calls make Longbridge answer **HTTP 429 code `429003`
("minimum 0.02 s between calls")**, which `providerError` maps to `502 provider_error`. Sequential calls each return 10
items. So the fix is pacing/retry on the data side (and bounded concurrency on the web side), not a news-path bug.

## Background
A bare `N` fans out one `GET /v1/news?symbol=` per symbol of the first watchlist group (up to 6, fired at once). One of
them occasionally answers 502 `provider_error`. The panel already tolerates a partial failure (merges the feeds that
succeeded), but the e2e that opens `N` right after other panels can hit a run where the flaky request was the only
feed. Suspects: Longbridge news rate limit under the burst, or a transient upstream error that the data service turns
into 502 without retry.

## Round 1 result and amendment (human acceptance, 2026-09-25 19:42 HKT)
Delivered: 30 s coalescing news cache + one 100 ms retry on 429 (data `0f8248e`), bounded fan-out of 2 (web `0067783`). The
bare-`N` panel is stable (5/5 + 3/3 runs), but a cold 6-parallel API burst right after ~40 news calls still returned
`502 200 502 200 200 200` (`429003` twice in the data log): one retry is not enough once the window is saturated.
**Rejected at acceptance; rework on the data side**: pace upstream news calls ≥ 20 ms apart, retry up to 3× with
100/300/900 ms + jitter, injected timing in tests. Criterion 1 is amended below.

## Acceptance criteria
- [x] Reproduce with the production data logs (`deploy.sh logs data`, look for `provider failure … news`) and name the upstream error code — `429003`
- [ ] (amended) On production, after a warm-up of 30 news calls in 60 s, a cold 6-parallel `/v1/news` burst returns 6/6 200, twice
- [ ] data: news fetches for a burst of symbols share a short-TTL cache like history/intraday (`provider.Cached`), and a rate-limit answer is retried once with backoff before becoming a 502
- [ ] web: `N` requests the feeds with bounded concurrency (e.g. 2 at a time) instead of all at once
- [ ] e2e "bare N merges several symbols' news" passes 5 consecutive runs against production
- [ ] `make lint test` passes in both repos

## Out of scope
Changing which symbols a bare `N` covers.
