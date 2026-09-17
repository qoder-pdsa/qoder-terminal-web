# BL-07 · Watch Agent (finale)

- **Depends on**: BL-04-1, BL-05, BL-06-1

User input: `ASK alert me if Tencent falls below its 50-day moving average while main capital is net flowing out`
→ analyst parses the natural language into a structured rule → evaluates it in the background → pushes an `alert` event when triggered → the terminal shows the alert and the reason in the top-right corner.

The PM digital worker splits it across three repos following "contract provider first":
- analyst: rule model, `alert` event schema, evaluation loop
- data: batch query endpoints if needed
- web: alert center UI + e2e
