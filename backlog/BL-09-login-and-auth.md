# BL-09 · 登录与全链路鉴权（跨 4 个 repo）

未登录用户不能访问任何行情与分析；登录后记录用户行为。

| 工作项 | Repo | Depends on | 内容 |
|---|---|---|---|
| BL-09-1 | user | 无 | 契约确认：JWT `iss=qoder-terminal-user`、`aud=qoder-terminal`、`sub`=用户 ID；补充登录限流（同一用户名 5 次/分钟） |
| BL-09-2 | data | BL-09-1 | 中间件：从 `USER_JWKS_URL` 拉取并缓存公钥，校验签名 / iss / aud / exp；`/health` 除外，其余 401 |
| BL-09-3 | analyst | BL-09-1 | 同上（FastAPI 依赖注入）；调用 data 时透传用户 token |
| BL-09-4 | web | BL-09-1 | 登录页；token 存内存 + sessionStorage；所有请求带 `Authorization`；401 回到登录页 |
| BL-09-5 | web | BL-09-4 | 执行命令、ASK、打开面板时上报 `/v1/activities`；新功能码 `HIST` 查看自己的历史 |
| BL-09-6 | web | BL-09-2, BL-09-3, BL-09-5 | e2e：测试账号登录后跑现有用例；未登录访问 data / analyst 返回 401 |

BL-09-2 / 3 / 4 在 Go、Python、TypeScript 三个 repo 中**并行**进行。
测试账号凭据由 AutoWonder `FRONTEND_TEST_URL` 配置中的凭据引用提供，不写入仓库。
