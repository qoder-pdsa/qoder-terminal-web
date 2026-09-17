# Demo Script (~20 minutes, during Hong Kong trading hours)

> Principle: every act must let the audience **see collaboration**, not just see code being generated.

## Act 0 · Starting point (2 min)
- Four repos in four languages (Go / Python / Java / TypeScript). The terminal already supports `700 Q` (**live Hong Kong market data**) and `ASK compare Tencent and Alibaba`.
- `GP`, `N`, and `W` are still placeholder panels — they are what we deliver today.

## Act 1 · Single-repo delivery (5 min)
- Work item **BL-01: EMA / RSI in data**, assigned to the "Standard Automated Delivery" squad.
- Highlights: QoderCLI runs the baseline → writes failing tests → implements in Go → lint gate → evidence upload.

## Act 2 · Cross-repo parallel work (8 min)
- Epic **BL-02: GP price chart panel**, or **BL-06: capital flow** (data → analyst / web in parallel).
- Highlights:
  1. data merges the contract change first, then analyst (Python) and web (TS) are worked on **by two developer digital workers at the same time**.
  2. The CR digital worker REJECTs once (e.g. the frontend does `parseFloat` math on prices) and development reworks.
  3. QA deploys and runs `make e2e`, attaches UI screenshots as evidence, and hands off for human acceptance.

## Act 3 · Agentic climax (5 min)
- Ask in the terminal: `ASK Is main capital flowing out of Tencent today? Which news explains it?`
- Tool calls scroll on the right (quote → capital flow → news), `700.HK GP` opens automatically on the left, and a cited conclusion follows.
- If BL-07 is done: set a watch rule live and trigger an alert.

## Fallbacks
- Longbridge outage or lunch break: `DATA_PROVIDER=mock` (BL-03 replay later).
- analyst defaults to `stub`, so it runs without a model.
- Pre-record a backup video of every act.
