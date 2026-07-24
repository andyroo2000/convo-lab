# Static Frontend Runtime

Convo Lab has a dedicated Nginx image for serving the built React application
without starting the retired Express backend:

```bash
docker build --file Dockerfile.frontend --tag convolab-frontend:local .
docker run --rm --publish 127.0.0.1:3001:3001 convolab-frontend:local
```

In another terminal, run the same behavioral smoke check used by CI:

```bash
./deploy/smoke-static-frontend.sh
```

The image is intentionally a drop-in frontend upstream on port `3001`. It does
not contain Prisma, Redis, database credentials, server source, or migration
startup logic.

## Runtime Contract

- `/health` reports whether the static frontend process is available.
- Public marketing and tool routes serve pre-rendered entry documents with
  route-specific title, description, canonical, Open Graph, and Twitter tags.
- Application and authentication routes serve the SPA with
  `noindex,nofollow`.
- Unknown browser routes serve the not-found SPA entry document.
- Unknown `/api` paths return a JSON `404` instead of the SPA.
- Retired `/study-media` paths return `404` instead of the SPA.
- Hashed assets are immutable; HTML, service worker, and manifest responses are
  not cached.
- Legacy tool paths keep their permanent redirects.

`shared/seo.mjs` is the source of truth for SEO metadata, route classes, and
legacy redirects. The legacy combined image imports it for rollback
compatibility, and the static image uses it at build time to generate HTML
entrypoints and Nginx route configuration.

## Deployment Boundary

Staging and production run the static image while preserving their established
container names and host ports, so Caddy and health tracking do not need a
coordinated reconfiguration. Production keeps its blue/green router: the
inactive static color is verified before traffic switches, and the prior color
is stopped but retained until the next deploy for rollback.

Learning OS owns backend health, migrations, and API behavior. Its deployment
workflow uses a short-lived Node tooling container for smoke assertions instead
of borrowing a JavaScript runtime from the frontend. Static frontend health
only proves that Nginx can serve the built client.
