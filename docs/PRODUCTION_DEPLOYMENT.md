# Production Deployment

## Blue/green web deploys

Production uses a stable nginx router container named `convolab-server`.
The router owns host port `3001` and forwards traffic to either
`convolab-server-blue` or `convolab-server-green` on the internal Docker
network. Those color containers retain their established names for a safe
cutover, but they run the Nginx-only `convolab-frontend` image. Learning OS
owns API behavior and Postgres; the frontend colors have no application
secrets, database connection, or migration responsibility.

The production workflow deploys the inactive color, waits for that frontend
container to become healthy, reloads the router to the new color, runs the
public static-frontend and Learning OS API smoke contracts, and then stops the
old color. It leaves the stopped prior color in place until the next deploy so
its exact image remains available for rollback. Postgres and the Learning OS
API/worker stay running during frontend deploys.

The staging build publishes only the `convolab-frontend` image. The legacy
combined Express image is no longer built or published.

The GitHub Actions workflow is the authoritative way to start or switch the
production web stack. It creates `/opt/convolab-runtime/prod-router/default.conf`
before starting the router and can bootstrap a fresh production stack. If a
container named `convolab-server` exists without the expected router role, the
workflow stops for manual inspection rather than replacing the unexpected
container.

## Memory budget

The workflow prunes unused Docker data and then requires at least 1024 MB of
`MemAvailable` before it starts a blue/green switch. That value is headroom above
the already-running production services: Postgres, Learning OS, the worker,
the router, and the active frontend color.

During the overlap window, the deploy briefly adds one inactive frontend
container with a 128 MB limit and 32 MB reservation, plus image extraction and
rollback headroom.

## Manual rollback

Use this only if a deploy succeeds but the new color is bad at runtime.

1. SSH to the droplet and enter `/opt/convolab`.
2. Read the active color:
   `cat /opt/convolab-runtime/prod-active-color`.
3. Choose the previous color: if active is `blue`, previous is `green`; if
   active is `green`, previous is `blue`.
4. Confirm the stopped previous container is present:
   `docker inspect convolab-server-<previous>`.
5. Start the exact previous frontend container:
   `docker start convolab-server-<previous>`.
6. Render the router config back to the previous color:
   `sed 's#__UPSTREAM_SERVICE__#convolab-server-<previous>#g' deploy/prod-router.conf.template > /opt/convolab-runtime/prod-router/default.conf`.
7. Reload the router:
   `docker exec convolab-server nginx -t && docker exec convolab-server nginx -s reload`.
8. Verify public health and the relevant API routes:
   `curl -fsS https://convo-lab.com/health`.
9. Persist the rollback color:
   `printf '%s\n' <previous> > /opt/convolab-runtime/prod-active-color.tmp && mv /opt/convolab-runtime/prod-active-color.tmp /opt/convolab-runtime/prod-active-color`.
10. Stop the bad color after health is confirmed:
    `docker stop convolab-server-<bad-color>`.

## Backend migrations

Frontend deploys never run database migrations. Learning OS migrations and
their Postgres portability checks belong to the separate `Deploy Learning OS
(Production)` workflow. That workflow uses a short-lived
`convolab-deployment-tools` Node container for JSON assertions and token
decoding, so backend deploy verification does not depend on the frontend image.
