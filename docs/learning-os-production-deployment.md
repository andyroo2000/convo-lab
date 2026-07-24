# Learning OS Production Deployment

Learning OS runs as an internal-only API and worker on ConvoLab's production
Docker network. ConvoLab remains the public edge, authenticates the browser,
and proxies explicitly allowlisted Study, Episode, and Course read routes to Learning OS.

The Study cutover is complete. Production routing is not controlled by database
feature flags, and the deployment workflow does not compare against or restore
the retired ConvoLab Study backend.

Login, current-account reads, profile/onboarding writes, signup, and email
verification are also served by Learning OS. Their independently reversible
environment flags default to `false` in Compose. The production workflow arms
rollback, enables them on the active server, and retains them only after the
profile write and disposable account lifecycle rehearsals pass.

## Workflow Inputs

Run `Deploy Learning OS (Production)` with:

- `image_tag`: an immutable `main-<full-sha>` Learning OS image tag.
- `smoke_user_email`: the ConvoLab account used for authenticated smoke checks.

The proxy currently supports the configured smoke account only. ConvoLab
rejects Learning OS proxy requests from any other account. Replace this
single-user restriction only after Learning OS consumes trusted per-request
identity or ConvoLab provisions per-user upstream tokens.

## Production Prerequisites

Before the first auth-capable deployment, configure these non-secret values in
the production host's `/opt/convolab/.env.production`:

- `EMAIL_FROM` (optional): a sender-address override, optionally including a
  display name. The deployment defaults it to
  `ConvoLab <noreply@convolab.app>` when absent.
- `CLIENT_URL`: the HTTPS ConvoLab origin used to build verification links.
- `ADMIN_EMAILS`: the comma-separated allowlist used when a verified account
  should receive the admin role.

Store `RESEND_API_KEY` as the repository's GitHub Actions secret of the same
name. The deployment copies that masked secret into `.env.production`; the
remaining values are maintained directly on the production host.

The deployment validates these values before pulling or restarting containers,
then verifies the effective Laravel configuration after the API becomes
healthy. It stores a SHA-256 fingerprint of the combined auth-mail settings so
credential or sender changes recreate both the API and worker even when the
image is unchanged. Secret values are not printed by these checks.

## Deployment

The workflow:

1. Validates the immutable image tag, smoke account, and auth mail prerequisites.
2. Runs Learning OS migrations against the existing copied database.
3. Refreshes the read-only Episode and Course compatibility tables from the ConvoLab
   production database.
4. Rotates the read/write-scoped proxy token.
5. Starts or reconciles the private API and worker.
6. Recreates the active ConvoLab web color with the new token.
7. Verifies the active container received that token, then prunes older tokens.
8. Runs authenticated current-account, generation-quota, profile, disposable
   signup/verification, Study, import, media, Daily Audio, Episode, and Course
   smoke checks through ConvoLab's public proxy.
9. Verifies public ConvoLab health.

The worker is drained before replacement when its image or command changes.
An unchanged healthy worker is left running when only the proxy token rotates.
The completed ConvoLab database-copy and historical-media import controls are
not available because Learning OS now owns newer Study state. Recover the
database from a Learning OS backup instead of rebuilding it from ConvoLab.

## Smoke Coverage

Every deployment verifies:

- Overview response through Learning OS.
- Current-account and generation-quota responses plus a reversible profile
  preference write.
- A disposable signup, email-token issuance, verification, current-account,
  and fresh-login lifecycle that confirms no legacy Prisma user was created.
- Browser list and note detail against Learning OS state.
- Settings read plus an idempotent settings write.
- New Queue read plus two idempotent reorder writes.
- Study session start response shape.
- Card draft create, poll, update, and delete cleanup.
- Learning OS-owned media creation, authenticated streaming headers, and
  cleanup.
- Existing Daily Audio list, detail, status, and authenticated audio streaming.
- Episode library list and, when data exists, one Episode detail response.
- Course library list and, when data exists, one Course detail response.
- A disposable import lifecycle with temporary users and a representative
  `.colpkg`.

The import smoke creates two notes, three cards, two review logs, and a 32 MiB
media entry. It restores the proxy identity and removes temporary users,
archives, imported rows, and media on both success and failure.

## Failure And Rollback

The deployment traps remove disposable auth accounts and invites, card drafts,
smoke-test media, imports, and unused proxy tokens. A failed deployment leaves
the currently active ConvoLab color serving until the replacement passes health
checks.

The retired `/api/learning-os/study/*` Express route is no longer available as
a rollback path. To roll back application code, redeploy the previous immutable
ConvoLab and Learning OS images. To recover data, restore a Learning OS database
backup.
