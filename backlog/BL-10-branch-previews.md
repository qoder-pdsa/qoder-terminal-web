# BL-10 · Per-branch Frontend Previews

Give every work item a link that shows what the change looks like, the way Vercel/Railway preview deployments do,
without running a full stack per branch.

- **Repo**: qoder-terminal-web
- **Depends on**: none
- **Squad**: Standard Automated Delivery

## Background
Human acceptance currently points at the shared production URL, so reviewers only see a change after it is merged and deployed.
A frontend-only preview covers the cases that actually need eyes — chart panels (BL-02), the news panel (BL-08), layout work —
at almost no cost: the preview reuses the shared backend through the existing gateway.

Out of scope: per-branch backends or databases (that is the full-stack preview, a separate item).

## Design
- Previews are static bundles built from a branch and served by the existing nginx gateway in the web container at `/preview/<slug>/`.
- `<slug>` is the branch name lowercased with every character outside `[a-z0-9-]` replaced by `-`, truncated to 40 characters; it must be validated, since it becomes a filesystem path.
- Built files live on the host in `/opt/qoder-terminal/previews/<slug>/` and are mounted read-only into the web container.
- API calls keep using the same-origin gateway paths (`/api/data`, `/api/analyst`), so a preview always talks to the shared backend.

## Acceptance criteria
- [ ] `deploy/deploy.sh preview <branch>` builds that branch's frontend with the correct base path and publishes it to `/opt/qoder-terminal/previews/<slug>/`, printing the resulting URL
- [ ] `deploy/deploy.sh preview-rm <slug>` removes one preview; `deploy/deploy.sh preview-ls` lists slug, branch, commit, build time, and size
- [ ] `docker-compose.prod.yml` mounts `/opt/qoder-terminal/previews` read-only into the web container; `deploy/nginx.conf` serves `/preview/<slug>/` with SPA fallback to that preview's own `index.html` and no caching of `index.html`
- [ ] Vite `base` is set at build time so assets resolve under `/preview/<slug>/`; deep links inside a preview do not fall back to the production SPA
- [ ] Retention: at most 10 previews, and previews older than 7 days are removed on the next `preview` run; `preview-rm` of a missing slug exits non-zero with a clear message
- [ ] Slug validation rejects `..`, absolute paths, and anything outside the allowed character set (unit-tested in a shell test or a small Go/Node test, whichever fits the repo)
- [ ] `deploy/ssh-gate.sh` allows `preview <branch>`, `preview-rm <slug>`, and `preview-ls` with the same argument validation as the existing subcommands
- [ ] e2e: after publishing a preview, `/preview/<slug>/` returns the app and a quote command works against the shared backend; production `/` is unaffected
- [ ] `docs/deployment.md` documents the commands, the URL shape, retention, and the "shared backend" caveat
- [ ] `make lint test` passes

## Follow-up (not part of this item)
Once this ships, the QA deployment configuration in the AutoWonder workspace is updated so `qa_deploy_setup` publishes a preview for the
reviewed branch and the acceptance handoff links to it instead of the production URL.
