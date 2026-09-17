# BL-01 · EMA 与 RSI 指标

- **Repo**: qoder-terminal-data
- **Depends on**: 无
- **建议小队**: 快速交付

## 验收标准
- [ ] 契约：`/v1/indicators/{symbol}` 的 `kind` 枚举加入 `ema`、`rsi`
- [ ] `indicators.EMA`：首个有效值为前 window 个收盘价的 SMA，之后按 `k = 2/(window+1)` 递推
- [ ] `indicators.RSI`：Wilder 平滑，前 window 个位置为 nil，取值 0~100；全部相等时的约定写在注释并测试
- [ ] table-driven 测试覆盖：空输入、window > len、window = 1
- [ ] 全程 `money.Decimal`，无 float64；`make lint test` 通过
