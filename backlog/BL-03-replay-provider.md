# BL-03 · Market Data Recording and Replay

- **Repo**: qoder-terminal-data
- **Depends on**: none

Demos do not always happen during trading hours, so we need a reproducible "live" experience.

## Acceptance criteria
- [ ] `cmd/record`: subscribe to Longbridge pushes during trading hours and write `recordings/<date>.jsonl`
- [ ] `DATA_PROVIDER=replay`: replay at the original intervals (configurable speed), with Quote / History behaving like longbridge
- [ ] Recordings are not committed (`.gitignore`), except a small sample for tests
