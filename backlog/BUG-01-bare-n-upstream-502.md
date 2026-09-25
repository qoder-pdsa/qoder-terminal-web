# BUG-01 · bare `N` intermittently shows an upstream 502 for one symbol

- **Repo**: qoder-terminal-data (likely) / qoder-terminal-web (mitigation)
- **Depends on**: none
- **Squad**: Standard Automated Delivery
- **Origin**: seen twice by the Demo Developer while verifying DEMO-5 (Playwright 30/31 on the first run, clean on rerun)

## Background
A bare `N` fans out one `GET /v1/news?symbol=` per symbol of the first watchlist group (up to 6, fired at once). One of
them occasionally answers 502 `provider_error`. The panel already tolerates a partial failure (merges the feeds that
succeeded), but the e2e that opens `N` right after other panels can hit a run where the flaky request was the only
feed. Suspects: Longbridge news rate limit under the burst, or a transient upstream error that the data service turns
into 502 without retry.

## Acceptance criteria
- [ ] Reproduce with the production data logs (`deploy.sh logs data`, look for `provider failure … news`) and name the upstream error code
- [ ] data: news fetches for a burst of symbols share a short-TTL cache like history/intraday (`provider.Cached`), and a rate-limit answer is retried once with backoff before becoming a 502
- [ ] web: `N` requests the feeds with bounded concurrency (e.g. 2 at a time) instead of all at once
- [ ] e2e "bare N merges several symbols' news" passes 5 consecutive runs against production
- [ ] `make lint test` passes in both repos

## Out of scope
Changing which symbols a bare `N` covers.
