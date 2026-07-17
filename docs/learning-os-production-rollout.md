# Learning OS Production Rollout

The Learning OS API runs as an internal-only container on ConvoLab's production
Docker network. ConvoLab remains the public edge and proxies only allowlisted,
feature-flagged Study API reads and explicitly enabled low-risk writes.

## Initial Deployment

Run the `Deploy Learning OS (Production)` workflow with:

- an immutable `main-<full-sha>` Learning OS image tag
- the ConvoLab email used for copied-data smoke checks
- `rebuild_database: true`
- `enable_settings: true`
- `enable_overview: false`
- `enable_browser: false`
- `enable_new_queue: false`
- `enable_settings_write: false`
- `enable_new_queue_write: false`
- `enable_imports: false`

The workflow:

1. Creates a custom-format backup of the live ConvoLab database under
   `/opt/convolab-backups` without modifying the source database.
2. When replacing an existing Learning OS database, securely exports its
   WaniKani connection, known-kanji, and Japanese knowledge-profile rows.
3. Restores the ConvoLab backup into a disposable `learning_os_convolab_source`
   database.
4. Creates and migrates the separate `learning_os` target database.
5. Imports users, settings, imports, cards, and reviews with production
   confirmation guards and `--skip-media`.
6. Restores the preserved Learning OS-owned rows by normalized user email,
   verifies exact row counts, and removes the temporary exports. The deployment
   aborts if any preserved account cannot be matched.
7. Runs the Learning OS smoke harness against the copied user.
8. Deletes the disposable restored source database but retains the dump.
9. Rotates a read/write-scoped Sanctum token, starts the private API, and recreates
   only the active ConvoLab web color with the upstream configuration.
10. Applies the requested route flag state, then compares every enabled
    Learning OS response with the legacy ConvoLab response for the same user and
    query before completing.

The initial proxy token represents the selected copied user. ConvoLab therefore
rejects Learning OS proxy requests from every other account, even though the
feature flags are global. Replace this single-user restriction only after
Learning OS consumes a trusted per-request identity or ConvoLab provisions
per-user upstream tokens.

If any verification fails, the workflow restores the complete Study API flag
state captured before deployment. Feature flags are cached by each ConvoLab
server process for up to 30 seconds, so allow that window for a rollback to
become fully inert. The Learning OS API and copied database remain available
for diagnosis without taking the existing ConvoLab Study API offline.

## Subsequent Deployments

Use `rebuild_database: false` to retain the copied Learning OS database. The
workflow still runs migrations, rotates the proxy token, health-checks the API,
and recreates the active ConvoLab web container.

Use `rebuild_database: true` only for an intentional new copy rehearsal. The
workflow first backs up any existing `learning_os` database before replacing
it. WaniKani connections, known kanji (including manual additions), and
Japanese knowledge versions are preserved across the rebuild and remapped to
the rebuilt users by normalized email.

Rebuild immediately before enabling Overview, Browser, or New Queue so the
comparison uses a fresh copy of the live ConvoLab data. Avoid studying or
changing the queue during that short comparison window; this rollout does not
dual-write changes between databases.

The four read-route inputs describe the desired final state. Keep Settings
enabled on later runs unless intentionally rolling it back. Enable the remaining
routes in this order:

1. Overview
2. Browser
3. New Queue

After all four reads are stable, enable low-risk writes separately:

1. `enable_settings_write` while `enable_settings` remains enabled
2. `enable_new_queue_write` while `enable_new_queue` remains enabled
3. `enable_imports`

The settings and queue write inputs default to false and cannot be enabled
unless their corresponding read route is enabled. The workflow rehearses each
of those writes against the copied Learning OS database using the current value
or queue order, then verifies the response is unchanged. These idempotent checks
exercise ConvoLab authentication, CSRF protection, feature gating, request
adaptation, and the private API without intentionally changing user-visible
state.

When `enable_imports` is true, the workflow performs a complete import
lifecycle through ConvoLab's public proxy. It creates short-lived users in both
databases, temporarily rotates the single-user proxy identity, and generates a
disposable `.colpkg` containing two notes, three cards, two review logs, and a
32 MiB stored media entry. The smoke checks readiness, streams the upload,
completes and polls the queued import, verifies Learning OS's persisted import
summary, and cancels a second import. It does not require any other Study API
child flag to be enabled.

The lifecycle script restores the original proxy identity and removes the
temporary users, uploaded archive, and imported media on both success and
failure. A cleanup failure fails the deployment. The outer deployment trap then
restores the complete previous feature-flag state, so imports are not left
enabled after an incomplete verification.

Each enabled read route receives an authenticated old-versus-new deep comparison
until its corresponding write flag is enabled:

- Settings: the complete settings object
- Overview: counts, limits, latest import, and next due timestamp in the same
  `America/New_York` timezone
- Browser: the first 25 rows, facets, totals, ordering, and cursor
- New Queue: the first 25 cards, totals, ordering, and cursor

After write cutover, Settings and New Queue can intentionally diverge from the
legacy database. Subsequent deploys use their idempotent write checks instead of
requiring stale legacy data to remain equal.

## Feature Flags

Keep these disabled until their rollout comparison passes:

- `studyApiOverview`
- `studyApiBrowser`
- `studyApiNewQueue`
- `studyApiImports`
- `studyApiSettingsWrite`
- `studyApiNewQueueWrite`

Media rows are intentionally omitted because ConvoLab does not persist trusted
byte sizes. Do not enable media-dependent reads until a separate media-byte and
verified-size migration is complete.

The import smoke fixture is independent of that legacy media migration: its
bytes are uploaded directly to Learning OS and removed with the disposable
smoke account. Enabling `studyApiImports` permits new Learning OS imports but
does not make missing media from the copied ConvoLab database available.

Rollback changes only feature flags; ConvoLab immediately returns disabled
routes to its existing Study API without a database restore. Once a write flag
is enabled for normal use, rollback does not copy Learning OS-only settings or
queue changes back into the legacy database. Take a fresh source backup before
write cutover and treat Learning OS as authoritative for each enabled write.
