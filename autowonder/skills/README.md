# AutoWonder skills and memories for Qoder Terminal

Source of truth for what the digital workers on `wonder.qoder.live` (workspace `qoder-terminal`) know beyond their SDLC
step instructions. The platform holds a runtime copy; edit here, then re-publish.

## Skills (SKILL packages, one `SKILL.md` each)

| Skill | Bound to | Purpose |
|---|---|---|
| [`qoder-terminal-delivery`](qoder-terminal-delivery/SKILL.md) | all six workers | repos, commands, non-negotiable rules, hand-offs |
| [`qoder-terminal-web`](qoder-terminal-web/SKILL.md) | Full-Stack Developer, Demo Developer, Code Reviewer | panel architecture, adding a function code, test patterns, previews |
| [`qoder-terminal-data`](qoder-terminal-data/SKILL.md) | Full-Stack Developer, Demo Developer, Code Reviewer | provider seam, money.Decimal, flight cache, Longbridge realities |
| [`qoder-terminal-deploy`](qoder-terminal-deploy/SKILL.md) | QA & Deployment Engineer | preview vs production mode, `deploy.sh` sequence, e2e against the target |
| [`read-only-code-review`](read-only-code-review/SKILL.md) | Code Reviewer | verifying evidence from git alone, defect checklist, routing |

The runtime mounts bound skills into the dispatch capsule as `skills/<name>/SKILL.md` (see qoder-wonder
`docs/scheduler-executor-protocol.md`), so keep each file self-contained and short enough to sit in the model's context
next to the step instructions.

## Memories (`../memories/*.md`)

ORG-scoped facts every worker should carry; they are created as `PENDING` and adopted through `/memories/reviews`.
Memories written by the workers themselves during dispatches show up on the same review page — adopt the ones that are
real, reusable lessons (and promote them to `SQUAD` scope) instead of letting them sit `PENDING`, where they never reach a dispatch.

## Publishing

Packages are uploaded with `POST /api/skills/package` (multipart: `file` = `<name>.zip` containing `SKILL.md` at the
root, `type=SKILL`, `providers=qoder`). **Use zip, not tar.gz**: the upload endpoint accepts both, but the dispatch
packager (`TaskPackager.extractCapability`) only reads zip, so a tar.gz skill fails every dispatch with
`TASK_PACKAGE_CONFIG_ERROR: skill package must contain root SKILL.md`. Packages are bound bound with `POST /api/agents/{id}/skills {skillId}`, and the resulting draft worker
versions go through `POST /api/agents/{id}/submit` → `/approve`. Updating a skill later is `PUT /api/skills/{id}/package`
with a new archive; bound workers pick up the new version on their next dispatch.
