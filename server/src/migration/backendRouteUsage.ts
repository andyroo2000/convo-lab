import { findBackendMigrationRoute } from './backendMigrationInventory.js';

export const BACKEND_ROUTE_USAGE_EVENT = 'backend_route_usage';

export interface BackendRouteUsageEvent {
  event: typeof BACKEND_ROUTE_USAGE_EVENT;
  schemaVersion: 1;
  routeId: string;
  surfaceId: string;
  domain: string;
  migrationWave: string;
  runtimeOwner: string;
  method: string;
  normalizedPath: string;
  statusCode: number;
  durationMs: number;
}

export const buildBackendRouteUsageEvent = (
  method: string,
  path: string,
  statusCode: number,
  durationMs: number
): BackendRouteUsageEvent | null => {
  if (path !== '/api' && !path.startsWith('/api/')) {
    return null;
  }

  const match = findBackendMigrationRoute(method, path);

  return {
    event: BACKEND_ROUTE_USAGE_EVENT,
    schemaVersion: 1,
    routeId: match?.route.id ?? 'unclassified',
    surfaceId: match?.surface.id ?? 'unclassified',
    domain: match?.surface.domain ?? 'unclassified',
    migrationWave: match?.surface.migrationWave ?? 'unclassified',
    runtimeOwner: match?.surface.runtimeOwner ?? 'unclassified',
    method: method.toUpperCase(),
    normalizedPath: match?.route.path ?? 'unclassified',
    statusCode,
    durationMs,
  };
};
