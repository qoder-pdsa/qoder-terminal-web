# TD-01 · analyst: validate tool arguments before they reach a URL path

- **Repo**: qoder-terminal-analyst
- **Depends on**: none — do before BL-05 (real LLM)
- **Squad**: Standard Automated Delivery
- **Origin**: Code Reviewer finding on BL-06-2 (work item 10007), non-blocking

## Background
`analyst.py` executes tool calls without validating the arguments against the tool's advertised JSON schema. With the
stub planner the arguments are synthesized internally, but once BL-05 lets a real model choose them, an unvalidated
`symbol` is interpolated straight into `GET /v1/…/{symbol}` (path traversal / unexpected upstream requests).

## Acceptance criteria
- [ ] Tool arguments are validated against `Tool.parameters` (JSON Schema, including the `^[0-9A-Z]{1,20}\.(HK|US|SH|SZ)$` symbol pattern) before the tool function runs; a violation emits `tool_result(ok=false)` and the stream continues
- [ ] Symbols are URL-encoded at the single place they enter a path
- [ ] Unit tests: valid args pass, a symbol like `../health` or `700.HK/x` is rejected without any HTTP call (`httpx.MockTransport` records zero requests)
- [ ] `make lint test` passes; `tests/test_contract.py` unchanged

## Out of scope
Changing the event schema or tool signatures.
