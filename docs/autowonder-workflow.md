# qoder-wonder（AutoWonder）× QoderCLI 工作流

平台：http://47.239.52.168 （qoder-wonder，AutoWonder 0.8.0 社区版），工作空间 **qoder-terminal**（id 10001）。

## 基础设施（阿里云香港，同一 VPC）

| 实例 | 内网 IP | 角色 |
|---|---|---|
| `qoder-wonder-260917-app` | 10.23.1.191 | qoder-wonder 平台（systemd + nginx + MySQL + Redis） |
| `qoder-wonder-260917-executor` | 10.23.1.192 | 数字人执行器（`qoderworker` 用户） |
| `qoder-terminal-app` | 10.23.1.193 | Qoder Terminal 生产环境，见 [deployment.md](deployment.md) |

## 小队：标准自动化交付

由官方 `initialize-autowonder-harness` skill 模板初始化，项目变量已按本项目填写（数据库、目标分支 `main`、部署方式）。

| 数字人 | roleCode | SDLC | repo 权限 | 执行器 | 模型 |
|---|---|---|---|---|---|
| 全栈开发 | AW_FS_DEV | 全栈开发（7 步） | WRITE | qt-fs-dev-1 | Qwen3.8-Max 1M |
| 代码评审工程师 | AW_CR | 代码评审工程师（1 步） | READ | qt-cr-1 | Qwen3.8-Max 1M |
| 测试与部署工程师 | AW_QA | 测试与部署工程师（8 步） | WRITE | qt-qa-1 | Qwen3.8-Max 1M |
| 需求澄清 | AW_REQ_CLARIFIER | — | READ | qt-req-1 | GLM-5.3 400K |
| 项目经理 | AW_PM | — | READ | qt-pm-1 | GLM-5.3 400K |

## 执行器部署（executor 实例）

- systemd 模板服务 `qoder-terminal-executor@<name>`，启动脚本 `/opt/qoder-terminal-executors/run.sh`，
  每个执行器的配置 `/etc/qoder-terminal-executors/<name>.env`（600，含 executor token，不入库），日志 `/var/log/qoder-terminal-executors/<name>.log`。
- **每个执行器独立 HOME**：`/var/lib/qoder-wonder-executor/homes/<name>`。runtime 的 pid、config.json、任务队列都按 HOME 推导，
  共用 HOME 会互相覆盖、串领任务。共享内容以符号链接指回 `/var/lib/qoder-wonder-executor`：`.qoder`（qodercli 登录态）、`.local`（qodercli）、`.ssh`、`.gitconfig`、`.config`。
- 通过内网 `ws://10.23.1.191:7001/ws/executor` 连接平台。

## Git 权限

- 四个 repo 公开，拉取走匿名 HTTPS。
- 推送：每个 repo 一把可写 Deploy Key（GitHub 限制一把 key 只能绑定一个 repo），
  `~/.ssh/config` 为每个 repo 配 SSH 别名，`git config --global url.<别名>.pushInsteadOf https://github.com/qoder-pdsa/<repo>.git`。

## QA 部署通道

- 执行器 `ssh qoder-terminal-app deploy.sh <子命令>`（内网、BatchMode）。
- 部署机 `qtdeploy` 的 authorized_keys：`command="/usr/local/bin/qt-ssh-gate",restrict,from="10.23.1.192"`，
  只允许 deploy.sh 白名单子命令（源码 `deploy/ssh-gate.sh`）。
- 安全组：部署机 22 端口只对 10.23.1.192 开放，80 端口公网开放。

## 角色 × 命令速查

| 角色 | 做什么 | 依据 |
|---|---|---|
| 需求澄清 / 项目经理 | 把 `backlog/` 的 epic 拆成按 repo 划分的工作项，排依赖（契约提供方先行） | `backlog/_template.md` |
| 全栈开发（QoderCLI） | 基线 `make test` → TDD → `make lint test` → 推送业务分支交 CR | 各 repo `AGENTS.md` |
| 代码评审 | 只读评审：契约一致性、浮点价格、错误处理、凭证 | `.qoder/rules/autowonder-delivery.md` |
| 测试与部署 | 合并到 main → `deploy.sh sync main / build` → `db-status / db-backup / db-migrate` → `up / health` → e2e → 交人工验收 | [deployment.md](deployment.md) |
