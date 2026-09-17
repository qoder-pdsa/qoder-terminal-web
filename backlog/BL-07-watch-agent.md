# BL-07 · 盯盘 agent（压轴）

- **Depends on**: BL-04-1, BL-05, BL-06-1

用户输入：`ASK 如果腾讯跌破 50 日均线且主力资金净流出，就提醒我`
→ analyst 把自然语言解析为结构化规则 → 后台评估 → 触发时推送 `alert` 事件 → 终端右上角弹出告警与原因。

由 PM 数字人按“契约提供方先行”拆分到三个 repo：
- analyst：规则模型、`alert` 事件 schema、评估循环
- data：如需，补充批量查询接口
- web：告警中心 UI + e2e
