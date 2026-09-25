# TD-02 · web: stop polling a symbol the data service says does not exist

- **Repo**: qoder-terminal-web
- **Depends on**: none
- **Squad**: Standard Automated Delivery
- **Origin**: Code Reviewer finding on DEMO-7 (work item 10011), non-blocking

## Background
`705 Q` (a symbol Longbridge does not know) renders `ERROR: symbol not found` and then keeps re-polling
`/v1/quotes/705.HK` and `/v1/intraday/705.HK` every 10 s for as long as the panel is open; `W` does the same for a
group whose batch returns 404. Every poll is an upstream Longbridge call that can never succeed.

## Acceptance criteria
- [ ] A `404 not_found` from the data service stops the panel's polling (Q, W) and shows the error state; a later refresh is only attempted when the symbol changes
- [ ] Transient errors (502, network) keep the current behaviour: last good data stays, polling continues
- [ ] Unit test for the pure decision (`shouldKeepPolling(error)`), e2e: `705 Q` shows the error and the network log shows no second quote request within 12 s
- [ ] `make lint test` passes

## Out of scope
Symbol validation before the request, suggestions for near-miss symbols.
