# BL-04 · 实时推送与自选股

## BL-04-1 · data：WebSocket `/v1/stream`
- **Repo**: qoder-terminal-data
- **Depends on**: 无
- [ ] 契约：新增 `QuoteTick` 事件 schema（`api/quote-tick.schema.json` 已有草稿）与 `/v1/stream` 说明
- [ ] 客户端发送 `{"subscribe":["700.HK"]}`；longbridge provider 使用 `Subscribe` + `OnQuote`，mock 生成确定性波动
- [ ] 连接断开时释放订阅；遵守 Longbridge 500 个订阅上限

## BL-04-2 · data：自选股分组
- **Repo**: qoder-terminal-data
- **Depends on**: 无
- [ ] `GET /v1/watchlists`：longbridge provider 读取 `WatchedGroups`（用户 App 中的自选分组）

## BL-04-3 · web：Q 实时刷新 + W 自选股面板
- **Repo**: qoder-terminal-web
- **Depends on**: BL-04-1, BL-04-2
- [ ] 价格变动短暂高亮（沿用涨跌配色变量）；卸载时关闭连接，断线指数退避重连
- [ ] W 面板展示分组与实时价格
