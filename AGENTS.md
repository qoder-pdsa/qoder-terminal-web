# qoder-terminal-web — Agent 指南

TypeScript + React 19 + Vite。**消费方 repo**：
- 数据契约 `../qoder-terminal-data/api/openapi.yaml`
- 分析师契约 `../qoder-terminal-analyst/api/openapi.yaml`、`agent-event.schema.json`

同时是项目入口：`e2e/`、`docker-compose.yml`、`docs/`、`backlog/`、`shared-rules/`。

## 架构
- `src/commands/parse.ts` — 命令解析与标的规范化（纯函数，必须有单测）
- `src/panels/registry.tsx` — 功能码 → 面板；**新增面板只改这里 + 新建面板文件**
- `src/layout/slots.ts` — 固定 2x2 分屏：新面板放最前，超过 4 个丢弃最早的，空格子显示提示
- `src/panels/*Panel.tsx` — 每个面板一个文件，自己负责取数与 loading / error / empty 三态
- `src/api/` — 服务调用与契约类型；组件内不直接写 `fetch`
- `e2e/` — Playwright：`*.api.spec.ts` 契约与集成、`*.ui.spec.ts` 用户流程

## 规则
- 不得使用契约中不存在的字段；缺字段先在提供方 repo 提需求。
- 价格以字符串展示，**不做 `parseFloat` 运算**；图表库需要数字时集中在单个转换函数中。
- 港股默认市场：纯数字代码补 `.HK`。涨跌颜色只用 `--up` / `--down` 变量（配色方案见 BL-02）。
- 视觉：黑底、琥珀色主文字、等宽字体；颜色只用 `styles.css` 中的 CSS 变量。
- 交互元素带 `data-testid`；e2e 禁止 `waitForTimeout`，零用例或全 skip 不算通过。
- `shared-rules/` 修改后运行 `scripts/sync-rules.sh`。

## 命令
- `make test` / `make lint` / `make build` / `make dev`
- `make e2e-api` / `make e2e-ui`（需先 `./scripts/dev.sh`）
