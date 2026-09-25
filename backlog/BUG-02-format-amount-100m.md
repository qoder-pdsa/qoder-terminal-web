# BUG-02 · `formatAmount` renders amounts ≥ 100M ten times too small

- **Repo**: qoder-terminal-web
- **Depends on**: none
- **Squad**: Demo Fast Track (frontend only)
- **Origin**: found by the Full-Stack Developer while delivering BL-11 (work item 10014); pre-existing in `src/panels/capitalFlowData.ts`

## Background
`formatAmount("100000000.0000")` → `(100000000 / 1e6).toPrecision(3)` = `"100"` → `.replace(/\.?0+$/, "")` strips the
trailing zeros of the **integer** part → `"1"` + `"M"` = `1M`. Every amount whose 3-significant-digit form ends in
zeros and has no decimal point is wrong: 100M → 1M, 1.0B → 1B is fine but 2.00B → 2B (ok), 120M → 12M (wrong). It already
affects the CF distribution table and, since BL-11, the Q panel volume and W/CF anywhere `formatAmount` is used.

## Acceptance criteria
- [ ] Trailing-zero stripping only applies to the fraction part: `100000000` → `100M`, `120000000` → `120M`, `12345678` → `12.3M`, `1500000000` → `1.5B`, `950` → `950`, `-120000000` → `-120M`
- [ ] Table-driven unit test in `capitalFlowData.test.ts` covering the cases above (the existing cases keep passing)
- [ ] No other file changes; `make lint test` passes
- [ ] UI e2e unchanged (values are live); the developer's browser check shows a symbol with ≥ 100M volume rendering three digits

## Out of scope
Locale formatting, 万/亿 units.
