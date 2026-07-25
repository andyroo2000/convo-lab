# Learning OS Production Deployment

Learning OS runs as an internal-only API and worker on ConvoLab's production
Docker network. ConvoLab remains the public edge and routes explicitly
allowlisted API paths to Learning OS. Browsers authenticate directly with
Learning OS through first-party Sanctum sessions. Native apps authenticate
through the same public edge with Learning OS Sanctum bearer tokens; Learning
OS itself remains private.

The Study cutover is complete. Production routing is not controlled by database
feature flags, and the deployment workflow does not compare against or restore
the retired ConvoLab Study backend.

Login, current-account reads, profile/onboarding writes, signup, and email
verification are also served by Learning OS. These routes are permanent and
have no Convo Lab backend fallback.

Native token issuance and revocation (`/api/auth/tokens`), current-account
reads (`/api/me`), review-event sync, Study, and Daily Audio routes preserve
the native client's `Authorization` header. The edge still removes
`X-Convo-Lab-User-Id` so clients cannot spoof browser identity.

## Workflow Inputs

Run `Deploy Learning OS (Production)` with:

- `image_tag`: an immutable `main-<full-sha>` Learning OS image tag.
- `smoke_user_email`: the ConvoLab account used for authenticated smoke checks.

The smoke account identifies existing production data used by read-oriented
checks. Authenticated write checks use a disposable admin account and a
first-party browser session; the deployment does not provision an upstream
bearer token.

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

The Google Cloud service-account file lives at
`/opt/convolab-runtime/secrets/gcloud-key.json`. The first deployment after the
Express workspace retirement copies the existing ignored
`server/gcloud-key.json` file to that runtime-owned path when needed, preserves
the source as a fallback, and verifies owner `33:33` with mode `600`.

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
4. Removes retired proxy-token settings and revokes legacy proxy tokens.
5. Starts or reconciles the private API and worker.
6. Verifies anonymous internal readiness and the active ConvoLab web color.
7. Establishes a disposable first-party Sanctum browser session.
8. Runs authenticated current-account, profile, disposable signup/verification,
   Study, import, media, Daily Audio, Episode, and Course smoke checks through
   ConvoLab's public Learning OS routes.
9. Verifies public ConvoLab health.

The worker is drained before replacement when its image or command changes.
An unchanged healthy worker is left running.
The completed ConvoLab database-copy and historical-media import controls are
not available because Learning OS now owns newer Study state. Recover the
database from a Learning OS backup instead of rebuilding it from ConvoLab.

## Smoke Coverage

Every deployment verifies:

- Overview response through Learning OS.
- Current-account responses plus a reversible profile preference write.
- A disposable signup, email-token issuance, verification, current-account,
  and fresh-login lifecycle that confirms no duplicate compatibility user was
  created.
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
media entry. It removes temporary users, archives, imported rows, and media on
both success and failure.

## Failure And Rollback

The deployment traps remove disposable auth accounts and invites, card drafts,
smoke-test media, and imports. A failed deployment leaves the currently active
ConvoLab color serving until the replacement passes health checks.

The retired `/api/auth/csrf` and `/api/learning-os/study/*` Express routes are
no longer available as rollback paths. To roll back application code, redeploy
the previous immutable ConvoLab and Learning OS images. To recover data, restore
a Learning OS database backup.
