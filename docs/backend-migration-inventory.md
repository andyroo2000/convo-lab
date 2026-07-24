# Backend Migration Inventory

The machine-readable source of truth for the ConvoLab-to-Learning-OS backend
migration is:

`server/src/migration/backendMigrationInventory.json`

The inventory is now empty: every browser API route is served directly by
Learning OS at the production edge. While a route remains in the inventory,
each entry has:

- a stable `id` used by telemetry and migration PRs;
- its HTTP method and normalized public path;
- a domain and migration wave;
- its current runtime owner, with optional per-route overrides for partially
  migrated surfaces;
- the Express source file and mount path.

The inventory is runtime data, not a planning document that can silently drift.
`backendMigrationInventory.test.ts` extracts declarations from every listed
router and fails when the declared and inventoried routes or their order differ.
Order is part of the contract because Express resolves overlapping mounts and
routes in declaration order.

Browser mutations bootstrap Laravel Sanctum at `/sanctum/csrf-cookie`.
The retired Express `/api/auth/csrf` bootstrap falls through to the generic
Express API 404 so stale clients fail closed.

The drift checks intentionally recognize the repository's current convention:
default route imports, literal `app.use(path, router)` mounts, and literal
`router.method(path, ...)` declarations. When changing those conventions,
extend the extraction patterns in the same PR so a new mount cannot bypass the
inventory.

## Migration Waves

The waves preserve the rollout order:

1. `pattern`: prove the non-Study migration pattern with feature flags.
2. `content`: move courses, episodes, scripts, generation, and media surfaces as
   complete vertical slices.
3. `admin`: move authenticated administration after the content actions exist.
4. `authentication`: converge sessions, identity, verification, and password
   recovery.
5. `retirement`: move or remove small Express-only support endpoints.
6. `complete`: served directly by Learning OS and absent from this Express inventory.

`runtimeOwner = "express"` means the request is still handled by the ConvoLab
backend. No current inventory entry has that owner.

A migration PR updates the route or surface owner only when its deployed request
path is actually served by Learning OS. Once traffic bypasses Express, remove
the route from this Express inventory. Edge rewrites may temporarily preserve a
retired public path for stale clients without restoring Express ownership.

Use a route-level `runtimeOwner` only while a router is split between services.

Administration, Script Lab, feature flags, Study, content, generation, media,
analytics, and authentication all call Learning OS directly and are absent from
this Express inventory.

## Route Usage Telemetry

Every completed API response emits a JSON log event with
`event = "backend_route_usage"`. The event contains only bounded inventory
values:

```json
{
  "event": "backend_route_usage",
  "schemaVersion": 1,
  "routeId": "episodes.show",
  "surfaceId": "episodes",
  "domain": "content",
  "migrationWave": "content",
  "runtimeOwner": "express",
  "method": "GET",
  "normalizedPath": "/api/episodes/:id",
  "statusCode": 200,
  "durationMs": 18
}
```

Concrete path parameters, user IDs, query strings, request bodies, and response
bodies are not included. Requests under `/api` that do not match the inventory
are emitted as `unclassified`; the concrete path is intentionally omitted.

To aggregate logs from stdin:

```bash
docker logs convolab-server-blue 2>&1 \
  | npm run migration:route-usage
```

Or pass one or more saved log files:

```bash
npm run migration:route-usage -- production-blue.log production-green.log
```

The JSON report groups by method and route ID and includes request count, error
count, status-code counts, maximum duration, and p95 duration. Use it to:

- confirm a route is actively used before migrating it;
- identify low-traffic routes suitable for the next rehearsal;
- compare error rates before and after cutover;
- prove a legacy route has no traffic before removal;
- find `unclassified` requests that require an inventory update.

Telemetry remains temporarily on the generic Express `/api` 404 handler to
identify stale clients after the final route retirement. It emits to the
existing application log stream and does not add a database write or network
request. Remove the structured event and inventory machinery after the empty
inventory has been proven in production.

## Updating The Inventory

When adding, removing, or migrating a backend route:

1. Update the router and inventory in the same PR.
2. Keep existing route IDs stable when only implementation ownership changes.
3. Add a new ID when a new client-visible method/path contract is introduced.
4. Run the focused migration and request-logger tests.
5. Run `npm run precheck`.
6. Include the before/after runtime owner and production telemetry evidence in
   the PR description.

The Study, browser, admin, authentication, feature-flag, content, generation,
media, analytics, and CSRF bootstrap surfaces now terminate in Learning OS.
Express retains only the generic `/api` not-found handler while retirement
telemetry is observed.
