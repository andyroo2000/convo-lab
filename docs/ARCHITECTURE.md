# Convo Lab Architecture

Convo Lab is the browser application for the Learning OS platform. This
repository owns the React client, static frontend runtime, browser-to-API
routing contracts, and production deployment orchestration. Learning OS owns
all backend behavior and persistence.

## Runtime Topology

```text
Browser
  |
  v
Public edge (Caddy)
  |
  +-- browser pages and assets --> Convo Lab Nginx frontend
  |
  +-- allowlisted API routes ----> Learning OS Laravel API
                                      |
                                      +-- PostgreSQL
                                      +-- database queue worker
                                      +-- object storage
                                      +-- generation providers
```

The Convo Lab production frontend is an Nginx-only image. It contains the built
Vite client and generated route metadata; it has no application server,
database client, credentials, migrations, or background workers.

Learning OS runs as private API and worker containers on the production Docker
network. The public router explicitly forwards authentication, Study, content,
admin, media, and generation routes to Learning OS. Unknown API routes never
fall through to the SPA.

## Repository Boundaries

- `client/`: React application, browser API adapters, PWA, and component tests.
- `shared/`: types and utilities shared by frontend build-time code.
- `deploy/`: Nginx configuration, route generation, and static smoke checks.
- `.github/workflows/`: staging, production frontend, and Learning OS deployment
  orchestration.
- `.github/scripts/`: deployment contract and lifecycle smoke tests.

There is intentionally no backend workspace in this repository. Domain logic,
HTTP controllers, validation, migrations, queue jobs, and persistence models
belong in `learning-os`.

## Local Development

`npm run dev` starts Vite. Browser API requests proxy to Learning OS using
`LEARNING_OS_API_URL`, defaulting to `http://localhost:8080`. Named routes are
listed before the generic `/api` fallback so rewrite compatibility paths remain
deterministic.

The local frontend does not start PostgreSQL, Redis, Prisma, or an Express
server.

## Deployment

Staging builds and publishes only `convolab-frontend`. Production uses static
blue/green colors behind a stable Nginx router, verifies the inactive color,
switches traffic, runs public frontend and Learning OS route smoke checks, and
then retains the prior static color for rollback.

Learning OS deploys independently with an immutable image tag. Its workflow
runs database migrations, reconciles the API and worker, and exercises
authenticated browser lifecycles through the public Convo Lab routes.

The Learning OS GCS credential is stored outside the repository checkout under
`/opt/convolab-runtime/secrets/gcloud-key.json` and bind-mounted read-only.

## Ownership Rules

- Frontend components own presentation and browser interaction.
- Browser API adapters own request paths and client response parsing.
- Edge configuration owns public route delegation and header boundaries.
- Learning OS controllers own HTTP behavior.
- Learning OS requests own validation and normalization.
- Learning OS actions and services own business behavior.
- Learning OS models and migrations own persistence.

Changes that introduce backend code, database access, server-side secrets, or
queue processing into Convo Lab violate this boundary.
