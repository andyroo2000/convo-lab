# Production Deployment

## Blue/green web deploys

Production uses a stable nginx router container named `convolab-server`.
The router owns host port `3001` and forwards traffic to either
`convolab-server-blue` or `convolab-server-green` on the internal Docker
network.

The production workflow deploys the inactive color, waits for that app
container to become healthy, reloads the router to the new color, verifies
`https://convo-lab.com/health`, and then stops the old color. Postgres and
Redis stay running during deploys. The worker is recreated after web traffic
has already switched.

The first rollout from the legacy single-container shape may include one brief
cutover while the old `convolab-server` app container is replaced by the nginx
router. Future successful deploys should not drop web traffic during the app
switch.

The GitHub Actions workflow is the authoritative way to start or switch the
production web stack. It creates `/opt/convolab-runtime/prod-router/default.conf`
before starting the router; a manual `docker compose up` on a fresh droplet will
fail until that config exists.

## Memory budget

The workflow prunes unused Docker data and then requires at least 2500 MB of
`MemAvailable` before it starts a blue/green switch. That value is headroom above
the already-running production services: Postgres, Redis, the worker, the router
if present, and the active web color.

During the overlap window, the deploy briefly adds one inactive web container
with a 1024 MB limit and 512 MB reservation, plus image extraction and rollback
headroom. If normal production memory usage grows, raise the workflow threshold
before increasing service limits or enabling larger synchronous workloads.

## Manual rollback

Use this only if a deploy succeeds but the new color is bad at runtime.

1. SSH to the droplet and enter `/opt/convolab`.
2. Read the active color:
   `cat /opt/convolab-runtime/prod-active-color`.
3. Choose the previous color: if active is `blue`, previous is `green`; if
   active is `green`, previous is `blue`.
4. Confirm the previous app is present and healthy, or start it:
   `docker compose -p convolab-prod -f docker-compose.prod.yml --env-file .env.production up -d --no-deps server-<previous>`.
5. Render the router config back to the previous color:
   `sed 's#__UPSTREAM_SERVICE__#convolab-server-<previous>#g' deploy/prod-router.conf.template > /opt/convolab-runtime/prod-router/default.conf`.
6. Reload the router:
   `docker exec convolab-server nginx -t && docker exec convolab-server nginx -s reload`.
7. Verify public health:
   `curl -fsS https://convo-lab.com/health`.
8. Persist the rollback color:
   `printf '%s\n' <previous> > /opt/convolab-runtime/prod-active-color.tmp && mv /opt/convolab-runtime/prod-active-color.tmp /opt/convolab-runtime/prod-active-color`.
9. Stop the bad color after health is confirmed:
   `docker stop convolab-server-<bad-color>`.

## Migration compatibility checklist

Blue/green deploys require the old and new app versions to tolerate the same
database schema during the traffic switch.

Use expand, deploy, backfill, contract:

1. Expand the schema first with backward-compatible changes: nullable columns,
   new tables, safe indexes, or additive enum values.
2. Deploy app code that can tolerate both old and new data shapes.
3. Backfill data separately when needed.
4. Contract in a later deploy: drop old columns, tighten `NOT NULL`, remove
   compatibility code, or make destructive enum changes.

Avoid one-step renames, immediate `NOT NULL` additions without safe defaults,
and dropping fields still read by the previously deployed app.
