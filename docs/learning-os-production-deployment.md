# Learning OS Production Deployment

Learning OS runs as an internal-only API and worker on ConvoLab's production
Docker network. ConvoLab remains the public edge, authenticates the browser,
and proxies only explicitly allowlisted Study routes to Learning OS.

The Study cutover is complete. Production routing is not controlled by database
feature flags, and the deployment workflow does not compare against or restore
the retired ConvoLab Study backend.

## Workflow Inputs

Run `Deploy Learning OS (Production)` with:

- `image_tag`: an immutable `main-<full-sha>` Learning OS image tag.
- `smoke_user_email`: the ConvoLab account used for authenticated smoke checks.

The proxy currently supports the configured smoke account only. ConvoLab
rejects Learning OS proxy requests from any other account. Replace this
single-user restriction only after Learning OS consumes trusted per-request
identity or ConvoLab provisions per-user upstream tokens.

## Deployment

The workflow:

1. Validates the immutable image tag and smoke account.
2. Runs Learning OS migrations against the existing copied database.
3. Rotates the read/write-scoped proxy token.
4. Starts or reconciles the private API and worker.
5. Recreates the active ConvoLab web color with the new token.
6. Verifies the active container received that token, then prunes older tokens.
7. Runs authenticated read, write, import, media, and Daily Audio smoke checks
   through ConvoLab's public proxy.
8. Verifies public ConvoLab health.

The worker is drained before replacement when its image or command changes.
An unchanged healthy worker is left running when only the proxy token rotates.
The completed ConvoLab database-copy and historical-media import controls are
not available because Learning OS now owns newer Study state. Recover the
database from a Learning OS backup instead of rebuilding it from ConvoLab.

## Smoke Coverage

Every deployment verifies:

- Overview response through Learning OS.
- Browser list and note detail against Learning OS state.
- Settings read plus an idempotent settings write.
- New Queue read plus two idempotent reorder writes.
- Study session start response shape.
- Card draft create, poll, update, and delete cleanup.
- Learning OS-owned media creation, authenticated streaming headers, and
  cleanup.
- Existing Daily Audio list, detail, status, and authenticated audio streaming.
- A disposable import lifecycle with temporary users and a representative
  `.colpkg`.

The import smoke creates two notes, three cards, two review logs, and a 32 MiB
media entry. It restores the proxy identity and removes temporary users,
archives, imported rows, and media on both success and failure.

## Failure And Rollback

The deployment trap removes disposable card drafts, smoke-test media, imports,
and unused proxy tokens. A failed deployment leaves the currently active
ConvoLab color serving until the replacement passes health checks.

There is no runtime Study-route flag rollback. To roll back application code,
redeploy the previous immutable ConvoLab and Learning OS images. To recover
data, restore a Learning OS database backup.
