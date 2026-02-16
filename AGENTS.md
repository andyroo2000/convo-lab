# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

## Staging CI First-Attempt Checklist

Before pushing to `main`, run this quick gate:

1. `npm run precheck` (fast safety check)
2. If touching infra/build/deploy files, also run:
   - `npm run precheck:full`
3. Verify GitHub Actions billing is healthy:
   - GitHub -> Settings -> Billing and plans
   - Recent failures have often been account billing/spending-limit, not code.
4. Confirm staging endpoint currently responds:
   - `curl -fsS https://stage.convo-lab.com/health`
   - If this fails before deploy, fix staging health first.

### Known Failure Signatures (and what to do)

- **"The job was not started because recent account payments have failed or your spending limit needs to be increased"**
  - Root cause: GitHub Actions billing/spending limit.
  - Action: fix billing first; reruns will keep failing until this is resolved.

- **`KeyError: 'ContainerConfig'` during deploy on droplet**
  - Root cause: legacy `docker-compose` v1 recreate bug on host.
  - Action: use `docker compose` (v2) on the droplet for recovery/redeploy.

- **Deploy step says server container is healthy, but workflow health check fails against `https://stage.convo-lab.com/health`**
  - Root cause: external route/LB/TLS/path issue (not app startup).
  - Action: validate both:
    - container-local health (`http://localhost:3001/health` inside host)
    - external domain health (`https://stage.convo-lab.com/health`)

## Pre-Push Formatting Scope

- Repo-wide `format:check` now excludes generated artifacts and legacy ops scripts via `.prettierignore`.
- Excluded paths include:
  - `client/dev-dist`
  - `server/scripts`
  - `server/src/scripts`
  - `scripts`
  - `check-*.ts`
  - `sample-courses-results.json`
  - `tools/kanban`
- For app changes, keep source files under `client/src`, `server/src` (excluding `server/src/scripts`), `shared/src`, `e2e`, and config files Prettier-clean before push.

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
