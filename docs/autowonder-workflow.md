# AutoWonder + QoderCLI 工作流

## 执行机准备

```bash
npm i -g autowonder                     # Runtime，qoder provider 需要 Node >= 20
# 安装并登录 qodercli
autowonder start --provider qoder \
  --token <executor-token> --executor-id <id> \
  --workspace-root ~/autowonder_workspaces
```

Runtime 收到 dispatch 后把工作空间关联的 repo 投影到 `workspace/repos/<repo>`，再驱动 qodercli 工作。
QoderCLI 自动加载每个 repo 的 `AGENTS.md` 与 `.qoder/rules/**/*.md`。

## 工作空间配置

1. 新建工作空间 `Qoder Terminal`，关联四个 repo。
2. 用 `initialize-autowonder-harness` skill 初始化小队模板：
   - **标准自动化交付**（需求澄清、项目经理、全栈开发、代码评审、测试与部署）—— 跨 repo 的 epic
   - **快速交付**（快速开发 → 快速部署）—— 单 repo 小需求
3. QA 部署目标：web repo 下 `docker compose up --build`；部署后测试：web `make e2e`。
4. data 的 Longbridge 凭证配置在执行机 / 部署环境变量中，**不进入任何 repo**。

## 角色 × repo × 命令

| 角色 | 做什么 | 依据 |
|---|---|---|
| 需求澄清 / 项目经理 | 把 `backlog/` 的 epic 拆成按 repo 划分的工作项，排依赖（契约提供方先行） | `backlog/_template.md` |
| 全栈开发（QoderCLI） | 基线 `make test` → TDD → `make lint test` → 提交交 CR | 各 repo `AGENTS.md` |
| 代码评审 | 只读评审：契约一致性、浮点价格、错误处理、凭证 | `.qoder/rules/autowonder-delivery.md` |
| 测试与部署 | 合并 → `docker compose up` → `/health` → `make e2e` → 交人工验收 | `docker-compose.yml`、`e2e/` |
| 数据库变更步骤 | 仅 user：备份 → `make db-migrate` → 核对 `flyway_schema_history`；其他 repo 不适用 | user `AGENTS.md` |
