# BL-06 · Capital Flow (Hong Kong feature; contract propagation + parallel demo)

Lets users ask "Is main capital flowing out of Tencent today?"

| Work item | Repo | Depends on | Scope |
|---|---|---|---|
| BL-06-1 ✅ 2026-09-25 | data | none | Contract: `GET /v1/capital-flow/{symbol}` (intraday net inflow series + large/medium/small order distribution); longbridge uses `CapitalFlow` + `CapitalDistribution`; mock implemented alongside |
| BL-06-2 ✅ 2026-09-25 (pipeline, work item 10007) | analyst | BL-06-1 | Add a `get_capital_flow` tool; the stub calls it when the question mentions "capital flow" and includes it in the summary |
| BL-06-3 ✅ 2026-09-25 | web | BL-06-1 | New function code `CF` (`700 CF`): net inflow bar chart + distribution |
| BL-06-4 | web | BL-06-2, BL-06-3 | e2e: API contract case + `700 CF` UI case + ASK capital-flow question case |

BL-06-2 and BL-06-3 run **in parallel** in different repos and languages — the best moment in the demo.
