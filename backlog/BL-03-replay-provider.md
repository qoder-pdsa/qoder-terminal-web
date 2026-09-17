# BL-03 · 行情录制与回放

- **Repo**: qoder-terminal-data
- **Depends on**: 无

演示时间不一定在交易时段，需要可复现的“实时”效果。

## 验收标准
- [ ] `cmd/record`：交易时段内订阅 Longbridge 推送，写入 `recordings/<date>.jsonl`
- [ ] `DATA_PROVIDER=replay`：按原始时间间隔（可配置倍速）回放，Quote / History 行为与 longbridge 一致
- [ ] 录制文件不入库（`.gitignore`），附一份小样例用于测试
