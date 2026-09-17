# BL-02 · GP 价格图面板

用户输入 `700 GP`，看到日 K 线并叠加 SMA20 / SMA50。

## BL-02-1 · web：K 线图面板
- **Repo**: qoder-terminal-web
- **Depends on**: 无（data 已提供 `/v1/history`、`/v1/indicators`）
- [ ] 新建 `GraphPanel.tsx` 并在 `registry.tsx` 替换占位；选用并说明图表库（建议 lightweight-charts）
- [ ] 支持 `700 GP 6M` 形式的区间参数（parse 单测）
- [ ] 价格字符串只在交给图表库时转换，集中在一个函数里并有单测
- [ ] 涨跌配色放在 CSS 变量中可切换（默认红涨绿跌，符合内地观众习惯；港交所惯例为绿涨红跌）
- [ ] loading / error / empty 三态；`data-testid="graph-panel"`
- [ ] e2e：`700 GP` 后图表 canvas 可见
