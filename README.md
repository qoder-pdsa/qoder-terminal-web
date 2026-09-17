# qoder-terminal-web

Qoder Terminal 的 **Bloomberg 风格前端**（TypeScript + React + Vite），同时是整个项目的**入口 repo**：
包含跨 repo 的 e2e、docker-compose、设计文档与 backlog。

## 项目全景

| Repo | 语言 | 职责 | 端口 |
|---|---|---|---|
| `qoder-terminal-data` | Go | 港股行情 / K 线 / 资讯 / 指标（mock 或 Longbridge） | 8081 |
| `qoder-terminal-analyst` | Python | AI 分析师（`ASK`） | 8082 |
| **`qoder-terminal-web`**（本 repo） | TypeScript | 终端 UI + e2e + 编排 | 5173 |

三个 repo 需放在同级目录下：

```bash
mkdir qoder-terminal && cd qoder-terminal
for r in data analyst web; do git clone git@github.com:qoder-pdsa/qoder-terminal-$r.git; done
```

## 快速开始

```bash
make install
./scripts/dev.sh                              # 同时启动三个服务（mock 数据）
DATA_PROVIDER=longbridge ./scripts/dev.sh     # 真实港股行情
make e2e-api && make e2e-ui                   # 服务启动后跑端到端
./scripts/test-all.sh                         # 三个 repo 的 lint + 单测
```

## 命令栏

| 输入 | 面板 | 状态 |
|---|---|---|
| `700 Q` / `0700.HK Q` | 报价 | ✅ |
| `ASK 对比腾讯和阿里` | AI 分析师（流式工具调用，自动开面板） | ✅ |
| `700 GP` | K 线 + 均线 | 🚧 BL-02 |
| `N` / `700 N` | 资讯 | 🚧 BL-08 |
| `W` | 自选股 | 🚧 BL-04 |

环境变量：`VITE_DATA_URL`（默认 `http://localhost:8081`）、`VITE_ANALYST_URL`（默认 `http://localhost:8082`）。

## 文档
- [架构](docs/architecture.md) · [AutoWonder 工作流](docs/autowonder-workflow.md) · [演示脚本](docs/demo-script.md) · [Backlog](backlog/README.md)
- 共享交付规则：[`shared-rules/`](shared-rules/)，修改后运行 `scripts/sync-rules.sh`
