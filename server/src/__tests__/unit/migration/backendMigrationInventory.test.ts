import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  backendMigrationInventory,
  findBackendMigrationRoute,
} from '../../../migration/backendMigrationInventory.js';

const repositoryRoot = fileURLToPath(new URL('../../../../../', import.meta.url));
const routerDeclarationPattern = /router\.(get|post|put|patch|delete|all)\(\s*['"]([^'"]+)['"]/g;
const routeImportPattern = /import\s+(\w+)\s+from\s+['"]\.\/routes\/([^'"]+)\.js['"]/g;
const routeMountPattern = /app\.use\(\s*['"]([^'"]+)['"]\s*,\s*(\w+)\s*\)/g;

const joinRoutePath = (mountPath: string, routePath: string): string => {
  const suffix = routePath === '/' ? '' : routePath;
  return `${mountPath}${suffix}`.replace(/\/+/g, '/');
};

describe('backend migration inventory', () => {
  it('has unique stable surface, route, and method/path identifiers', () => {
    const surfaces = backendMigrationInventory.surfaces;
    const routes = surfaces.flatMap((surface) => surface.routes);

    expect(new Set(surfaces.map(({ id }) => id)).size).toBe(surfaces.length);
    expect(new Set(routes.map(({ id }) => id)).size).toBe(routes.length);
    expect(
      new Set(routes.map(({ method, path: routePath }) => `${method} ${routePath}`)).size
    ).toBe(routes.length);
    expect(routes.length).toBeGreaterThan(80);
  });

  it('preserves every literal route in Express declaration order', () => {
    for (const surface of backendMigrationInventory.surfaces) {
      const sourcePath = path.join(repositoryRoot, surface.sourceFile);
      expect(fs.existsSync(sourcePath), surface.sourceFile).toBe(true);

      const source = fs.readFileSync(sourcePath, 'utf8');
      const declaredRoutes = [...source.matchAll(routerDeclarationPattern)].map((match) => ({
        method: match[1].toUpperCase(),
        path: joinRoutePath(surface.mountPath, match[2]),
      }));
      const inventoriedRoutes = surface.routes.map(({ method, path: routePath }) => ({
        method,
        path: routePath,
      }));

      expect(inventoriedRoutes, surface.sourceFile).toEqual(declaredRoutes);
    }
  });

  it('preserves every API router in server mount order', () => {
    const serverEntry = fs.readFileSync(path.join(repositoryRoot, 'server/src/index.ts'), 'utf8');
    const routeImports = new Map(
      [...serverEntry.matchAll(routeImportPattern)].map((match) => [
        match[1],
        `server/src/routes/${match[2]}.ts`,
      ])
    );
    const mountedRouters = [...serverEntry.matchAll(routeMountPattern)]
      .filter((match) => match[1] === '/api' || match[1].startsWith('/api/'))
      .map((match) => ({
        mountPath: match[1],
        sourceFile: routeImports.get(match[2]),
      }))
      .filter(
        (mount): mount is { mountPath: string; sourceFile: string } =>
          mount.sourceFile !== undefined
      );
    const inventoriedRouters = backendMigrationInventory.surfaces.map(
      ({ mountPath, sourceFile }) => ({ mountPath, sourceFile })
    );

    expect(inventoriedRouters).toEqual(mountedRouters);
  });

  it('resolves concrete dynamic paths to stable inventory routes', () => {
    expect(findBackendMigrationRoute('GET', '/api/episodes/episode-123')).toMatchObject({
      route: { id: 'episodes.show', path: '/api/episodes/:id' },
      surface: { id: 'episodes', runtimeOwner: 'learning-os-proxy' },
    });
    expect(findBackendMigrationRoute('DELETE', '/api/episodes/episode-123')).toMatchObject({
      route: { id: 'episodes.delete', path: '/api/episodes/:id' },
      surface: { id: 'episodes', runtimeOwner: 'learning-os-proxy' },
    });
    expect(findBackendMigrationRoute('POST', '/api/episodes')).toMatchObject({
      route: { id: 'episodes.store', path: '/api/episodes' },
      surface: { id: 'episodes', runtimeOwner: 'learning-os-proxy' },
    });
    expect(findBackendMigrationRoute('PATCH', '/api/episodes/episode-123')).toMatchObject({
      route: { id: 'episodes.update', path: '/api/episodes/:id' },
      surface: { id: 'episodes', runtimeOwner: 'learning-os-proxy' },
    });
    expect(findBackendMigrationRoute('GET', '/api/courses/course-123')).toMatchObject({
      route: { id: 'courses.show', path: '/api/courses/:id' },
      surface: { id: 'courses', runtimeOwner: 'learning-os-proxy' },
    });
    expect(findBackendMigrationRoute('POST', '/api/courses')).toMatchObject({
      route: { id: 'courses.store', path: '/api/courses' },
      surface: { id: 'courses', runtimeOwner: 'learning-os-proxy' },
    });
    expect(findBackendMigrationRoute('PATCH', '/api/courses/course-123')).toMatchObject({
      route: { id: 'courses.update', path: '/api/courses/:id' },
      surface: { id: 'courses', runtimeOwner: 'learning-os-proxy' },
    });
    expect(findBackendMigrationRoute('DELETE', '/api/courses/course-123')).toMatchObject({
      route: { id: 'courses.delete', path: '/api/courses/:id' },
      surface: { id: 'courses', runtimeOwner: 'learning-os-proxy' },
    });
    expect(findBackendMigrationRoute('POST', '/api/courses/course-123/generate')).toMatchObject({
      route: { id: 'courses.generate' },
      surface: { id: 'courses', runtimeOwner: 'learning-os-proxy' },
    });
    expect(findBackendMigrationRoute('GET', '/api/courses/course-123/status')).toMatchObject({
      route: { id: 'courses.status' },
      surface: { id: 'courses', runtimeOwner: 'learning-os-proxy' },
    });
    expect(findBackendMigrationRoute('DELETE', '/api/admin/invite-codes/invite-123')).toMatchObject(
      {
        route: { id: 'admin.invites.delete' },
        surface: { id: 'admin', migrationWave: 'admin' },
      }
    );
  });

  it('matches every method through the Learning OS Study proxy wildcard', () => {
    expect(
      findBackendMigrationRoute('PATCH', '/api/learning-os/study/cards/card-123')
    ).toMatchObject({
      route: { id: 'study.proxy', method: 'ALL' },
      surface: { id: 'study', runtimeOwner: 'learning-os-proxy' },
    });
  });

  it('records the feature-flags browser contract as Learning OS-owned through the proxy', () => {
    expect(findBackendMigrationRoute('GET', '/api/feature-flags')).toMatchObject({
      route: { id: 'feature-flags.show', method: 'GET', path: '/api/feature-flags' },
      surface: {
        id: 'feature-flags',
        migrationWave: 'pattern',
        runtimeOwner: 'learning-os-proxy',
      },
    });
  });

  it.each([
    ['GET', '/api/avatars/voices/ja-shohei.jpg', 'avatars.show', 'avatars'],
    ['POST', '/api/tools-audio/signed-urls', 'tool-audio.signed-urls', 'tool-audio'],
  ])('records %s %s as Learning OS-owned static media', (method, path, routeId, surfaceId) => {
    expect(findBackendMigrationRoute(method, path)).toMatchObject({
      route: { id: routeId },
      surface: {
        id: surfaceId,
        migrationWave: 'complete',
        runtimeOwner: 'learning-os-proxy',
      },
    });
  });

  it.each([
    ['GET', 'admin.feature-flags.show'],
    ['PATCH', 'admin.feature-flags.update'],
  ])('records the %s admin feature-flags contract as Learning OS-owned', (method, routeId) => {
    expect(findBackendMigrationRoute(method, '/api/admin/feature-flags')).toMatchObject({
      route: { id: routeId, method, path: '/api/admin/feature-flags' },
      surface: {
        id: 'admin-feature-flags',
        migrationWave: 'pattern',
        runtimeOwner: 'learning-os-proxy',
      },
    });
  });

  it('does not classify unknown methods or paths', () => {
    expect(findBackendMigrationRoute('POST', '/api/episodes/episode-123')).toBeNull();
    expect(findBackendMigrationRoute('GET', '/api/not-in-inventory')).toBeNull();
  });
});
