# 生产部署（阿里云香港）

## 拓扑

| 实例 | 角色 |
|---|---|
| `qoder-wonder-260917-app` | qoder-wonder（AutoWonder）平台 |
| `qoder-wonder-260917-executor` | 数字人执行器；QA 通过内网 SSH 部署 |
| `qoder-terminal-app` | Qoder Terminal：postgres + user + data + analyst + web（docker compose） |

浏览器只访问 `qoder-terminal-app:80`，由 web 容器内的 nginx 网关分发：

| 路径 | 转发到 |
|---|---|
| `/` | 前端静态页面 |
| `/api/data/` | data:8081 |
| `/api/analyst/` | analyst:8082（SSE，关闭缓冲） |
| `/api/user/` | user:8084 |
| `/healthz` | 网关自身 |

## 目录与凭证

```
/opt/qoder-terminal/src/<四个 repo>     # 部署检出目录（只读检出，禁止手工修改）
/opt/qoder-terminal/backups/            # 数据库备份（700）
/etc/qoder-terminal/qoder-terminal.env  # 凭证（600，不入库），格式见 deploy/qoder-terminal.env.example
```

## 部署步骤（`deploy/deploy.sh`，AutoWonder QA 数字人逐步调用）

| 步骤 | 命令 | 对应 QA SDLC 步骤 |
|---|---|---|
| 同步候选版本 | `deploy.sh sync <branch>` | 分支合并与部署准备 |
| 构建镜像 | `deploy.sh build` | 分支合并与部署准备（写库前构建） |
| 迁移状态 | `deploy.sh db-status` | 数据库变更预检 |
| 备份 | `deploy.sh db-backup` | 数据库变更执行（执行前） |
| 迁移 | `deploy.sh db-migrate` | 数据库变更执行 |
| 启动 | `deploy.sh up` | 应用部署（不构建、不迁移） |
| 健康检查 | `deploy.sh health` | 应用部署与健康检查 |
| 部署后测试 | web repo `e2e`，`WEB_URL=http://<公网 IP>` 等 | 部署后测试 |

服务启动时不会自动迁移数据库；迁移只能通过 `db-migrate` 执行。
