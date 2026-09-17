# BL-06 · 资金流向（港股特色，契约传播 + 并行演示）

让用户问出“腾讯今天主力资金在流出吗？”

| 工作项 | Repo | Depends on | 内容 |
|---|---|---|---|
| BL-06-1 | data | 无 | 契约：`GET /v1/capital-flow/{symbol}`（日内净流入序列 + 大/中/小单分布）；longbridge 用 `CapitalFlow` + `CapitalDistribution`；mock 同步实现 |
| BL-06-2 | analyst | BL-06-1 | 新增 `get_capital_flow` 工具；stub 在问题含“资金”时调用并写入摘要 |
| BL-06-3 | web | BL-06-1 | 新功能码 `CF`（`700 CF`）：净流入柱状图 + 分布 |
| BL-06-4 | web | BL-06-2, BL-06-3 | e2e：API 契约用例 + `700 CF` UI 用例 + ASK 资金问题用例 |

BL-06-2 与 BL-06-3 在不同 repo、不同语言中**并行**进行 —— 演示的最佳时机。
