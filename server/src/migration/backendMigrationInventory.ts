import { createRequire } from 'node:module';

export type BackendMigrationWave =
  | 'pattern'
  | 'content'
  | 'admin'
  | 'authentication'
  | 'retirement'
  | 'complete';

export type BackendRuntimeOwner = 'express' | 'learning-os-proxy';

export interface BackendMigrationRoute {
  id: string;
  method: string;
  path: string;
}

export interface BackendMigrationSurface {
  id: string;
  domain: string;
  migrationWave: BackendMigrationWave;
  runtimeOwner: BackendRuntimeOwner;
  sourceFile: string;
  mountPath: string;
  routes: BackendMigrationRoute[];
}

export interface BackendMigrationInventory {
  schemaVersion: number;
  targetService: 'learning-os';
  surfaces: BackendMigrationSurface[];
}

export interface MatchedBackendMigrationRoute {
  route: BackendMigrationRoute;
  surface: BackendMigrationSurface;
}

const require = createRequire(import.meta.url);
const inventoryData: unknown = require('./backendMigrationInventory.json');
const inventory = inventoryData as BackendMigrationInventory;

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const routePathPattern = (path: string): RegExp => {
  const segments = path.split('/').map((segment) => {
    if (segment === '*') return '.*';
    if (segment.startsWith(':')) return '[^/]+';
    return escapeRegex(segment);
  });

  return new RegExp(`^${segments.join('/')}/?$`);
};

const compiledRoutes = inventory.surfaces.flatMap((surface) =>
  surface.routes.map((route) => ({
    route,
    surface,
    pattern: routePathPattern(route.path),
  }))
);
const compiledRoutesByMethod = new Map<string, typeof compiledRoutes>();

for (const compiledRoute of compiledRoutes) {
  const methodRoutes = compiledRoutesByMethod.get(compiledRoute.route.method) ?? [];
  methodRoutes.push(compiledRoute);
  compiledRoutesByMethod.set(compiledRoute.route.method, methodRoutes);
}

export const backendMigrationInventory = inventory;

export const findBackendMigrationRoute = (
  method: string,
  path: string
): MatchedBackendMigrationRoute | null => {
  const normalizedMethod = method.toUpperCase();
  const methodRoutes = compiledRoutesByMethod.get(normalizedMethod) ?? [];
  const allMethodRoutes = compiledRoutesByMethod.get('ALL') ?? [];
  const match =
    methodRoutes.find(({ pattern }) => pattern.test(path)) ??
    allMethodRoutes.find(({ pattern }) => pattern.test(path));

  return match ? { route: match.route, surface: match.surface } : null;
};
