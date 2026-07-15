# Learning OS Production Rollout

The Learning OS API runs as an internal-only container on ConvoLab's production
Docker network. ConvoLab remains the public edge and proxies only allowlisted,
feature-flagged Study API reads.

## Initial Deployment

Run the `Deploy Learning OS (Production)` workflow with:

- an immutable `main-<full-sha>` Learning OS image tag
- the ConvoLab email used for copied-data smoke checks
- `rebuild_database: true`
- `enable_settings: true`

The workflow:

1. Creates a custom-format backup of the live ConvoLab database under
   `/opt/convolab-backups` without modifying the source database.
2. Restores that backup into a disposable `learning_os_convolab_source`
   database.
3. Creates and migrates the separate `learning_os` target database.
4. Imports users, settings, imports, cards, and reviews with production
   confirmation guards and `--skip-media`.
5. Runs the Learning OS smoke harness against the copied user.
6. Deletes the disposable restored source database but retains the dump.
7. Rotates a read-scoped Sanctum token, starts the private API, and recreates
   only the active ConvoLab web color with the upstream configuration.
8. Enables only `studyApiEnabled` and `studyApiSettings`, then verifies the
   authenticated public ConvoLab proxy route.

The initial proxy token represents the selected copied user. ConvoLab therefore
rejects Learning OS proxy requests from every other account, even though the
feature flags are global. Replace this single-user restriction only after
Learning OS consumes a trusted per-request identity or ConvoLab provisions
per-user upstream tokens.

If the final proxy request fails, the workflow disables both settings flags
before failing. The Learning OS API and copied database remain available for
diagnosis without taking the existing ConvoLab Study API offline.

## Subsequent Deployments

Use `rebuild_database: false` to retain the copied Learning OS database. The
workflow still runs migrations, rotates the proxy token, health-checks the API,
and recreates the active ConvoLab web container.

Use `rebuild_database: true` only for an intentional new copy rehearsal. The
workflow first backs up any existing `learning_os` database before replacing
it.

## Feature Flags

Keep these disabled until their data dependencies are proven:

- `studyApiOverview`
- `studyApiBrowser`
- `studyApiNewQueue`
- `studyApiImports`

Media rows are intentionally omitted because ConvoLab does not persist trusted
byte sizes. Do not enable media-dependent reads until a separate media-byte and
verified-size migration is complete.

Rollback for the Settings slice is limited to setting `studyApiEnabled` and
`studyApiSettings` to `false`; ConvoLab immediately returns to its existing
Study API without a database restore.
