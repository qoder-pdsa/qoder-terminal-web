---
title: Work item status on the board never deploys anything — releases are a human step after acceptance
type: CONSTRAINT
scope: ORG
---

## Fact

Moving a work item to `done` / `completed` on wonder.qoder.live changes a field on the board and dispatches nobody. Production (`https://qoder.live`) only changes when a human runs `deploy.sh sync main → build → up → health` on the app host after merging the accepted branch into `main`. Digital workers deploy business branches (QA production mode) or publish previews, and never touch `main`.

Consequence seen on 2026-09-24: DEMO-1 was marked completed on the board while its branch had never been merged; production kept running the old `main` until a human merged and released.

## How to apply

- Developers and reviewers: the handoff must name the branch and HEAD sha so the human can merge exactly what was accepted.
- QA: the handoff to the human must say which mode was used and the exact URL to accept on; do not describe a preview as "released".
- Never write "deployed to production" or "released" in evidence unless `deploy.sh up` printed the commit on the production host.
