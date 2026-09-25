# TD-03 · gateway / Go router: `..%2f` path segments normalize onto other routes

- **Repo**: qoder-terminal-web (`deploy/nginx*.conf`) and qoder-terminal-data (Go `http.ServeMux`); analyst FastAPI to confirm
- **Depends on**: none
- **Squad**: Standard Automated Delivery
- **Origin**: QA finding while verifying TD-01 (work item 10017), out of that item's scope

## Background
`curl --path-as-is https://qoder.live/api/data/v1/quotes/..%2f..%2fv1/watchlists` answers 200 from the watchlists route,
and `/api/analyst/v1/ask/..%2f..%2fhealth` answers 200 from the analyst health route: the encoded `..%2f` is decoded and
normalized somewhere between nginx and the backend routers. Today nothing sensitive is reachable (every target is a
public route, deeper sequences land on the SPA index, static traversal is refused with 400), but a route added later
under `/internal/…` would be reachable through a public prefix.

## Acceptance criteria
- [ ] Reproduce with `--path-as-is` against production and record which layer normalizes (nginx `merge_slashes` / proxy_pass with URI vs. Go `ServeMux` cleaning vs. Starlette)
- [ ] Requests whose raw path contains an encoded or literal `..` segment are rejected with 400 at the gateway (nginx `location` regex or `if ($request_uri ~ "%2e%2e|\.\.")`), before proxying
- [ ] Go handlers additionally refuse a `{symbol}` path value that decodes to something outside the symbol pattern (already true via `symbolPattern`; pin with a test)
- [ ] e2e contract case: the two probes above return 400; `deploy.sh health` 6/6 after the nginx change; `make lint test` in touched repos

## Out of scope
Authentication, rate limiting, WAF.
