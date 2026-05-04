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
