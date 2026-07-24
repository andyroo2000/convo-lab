# ConvoLab Identity Integration Guide

ConvoLab delegates browser identity, account management, email verification,
password reset, and Google OAuth to Learning OS. The ConvoLab Express server
does not own login or credential persistence.

## Public Routes

The production router sends these same-origin routes directly to Learning OS:

- `/sanctum/csrf-cookie`
- `/api/convolab/browser/auth/*`
- `/api/convolab/auth/*`
- `/api/auth/password/*`

The client route catalog lives in `client/src/lib/authApi.ts`. Keep it aligned
with `deploy/prod-router.conf.template` and the Learning OS ConvoLab
compatibility routes.

## Google OAuth

Create a Google OAuth web client and configure this production callback:

```text
https://convo-lab.com/api/convolab/browser/auth/google/callback
```

Store `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` as GitHub Actions secrets.
The production workflows pass them to Learning OS and set
`LEARNING_OS_GOOGLE_REDIRECT_URI` to the callback above. ConvoLab does not use a
`GOOGLE_CALLBACK_URL` environment variable.

For local OAuth work, configure the Learning OS checkout and its callback using
the Learning OS development documentation. The ConvoLab client should continue
calling same-origin paths; local Vite proxy rules route those requests to the
configured Learning OS service.

## Verification

Before changing identity routing:

```bash
npm run test:deployment
npm run test:run
npm run type-check
npm run lint
```

Production deployment checks verify:

- Sanctum CSRF and browser-session cookies
- unauthenticated account response shape
- Google OAuth redirect host, client ID, state, and exact callback
- signup, verification, login, logout, password reset, profile update, quota,
  and account deletion through a disposable user lifecycle

The lifecycle harness is
`.github/scripts/smoke-auth-signup-verification-lifecycle.sh`.

## Troubleshooting

1. Confirm `/health` reports healthy Redis and database connections.
2. Confirm `/api/convolab/auth/me` returns the Learning OS unauthenticated
   contract when called without a session.
3. Confirm the public Google OAuth start route redirects to Google with the
   callback shown above.
4. Check the Learning OS API and worker logs for verification or password-reset
   delivery failures.
5. Check `deploy/prod-router.conf.template` before changing route ownership.
