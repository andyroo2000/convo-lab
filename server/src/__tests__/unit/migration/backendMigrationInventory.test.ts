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
    expect(routes).toHaveLength(2);
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

  it('keeps only the shared CSRF bootstrap owned by Express', () => {
    const expressRouteIds = backendMigrationInventory.surfaces.flatMap((surface) =>
      surface.routes
        .filter((route) => (route.runtimeOwner ?? surface.runtimeOwner) === 'express')
        .map((route) => route.id)
    );

    expect(expressRouteIds).toEqual(['csrf.bootstrap']);
  });

  it('resolves concrete dynamic paths to stable inventory routes', () => {
    expect(findBackendMigrationRoute('POST', '/api/tools/analytics')).toBeNull();
    expect(findBackendMigrationRoute('POST', '/api/convolab/browser/tools/analytics')).toBeNull();
    expect(findBackendMigrationRoute('POST', '/api/audio/generate-all-speeds')).toBeNull();
    expect(findBackendMigrationRoute('POST', '/api/images/generate')).toBeNull();
    expect(
      findBackendMigrationRoute('GET', '/api/images/job/019c8e7f-5c48-7d32-ae6b-a1f268287c9b')
    ).toBeNull();
    expect(
      findBackendMigrationRoute(
        'GET',
        '/api/convolab/episodes/018f47ea-4b37-7f21-8d5a-90e157176b8a/audio/1.0'
      )
    ).toBeNull();
    expect(findBackendMigrationRoute('DELETE', '/api/admin/invite-codes/invite-123')).toBeNull();
    expect(
      findBackendMigrationRoute(
        'POST',
        '/api/admin/courses/44444444-4444-4444-8444-444444444444/build-prompt'
      )
    ).toBeNull();
    expect(findBackendMigrationRoute('GET', '/api/admin/script-lab/courses')).toBeNull();
    expect(findBackendMigrationRoute('POST', '/api/admin/script-lab/sentence-script')).toBeNull();
  });

  it('does not track retired Express identity entrypoints', () => {
    for (const [method, routePath] of [
      ['POST', '/api/auth/signup'],
      ['POST', '/api/auth/login'],
      ['GET', '/api/auth/me'],
      ['PATCH', '/api/auth/me'],
      ['PATCH', '/api/auth/change-password'],
      ['DELETE', '/api/auth/me'],
      ['POST', '/api/verification/send'],
      ['GET', '/api/verification/token'],
      ['POST', '/api/password-reset/request'],
      ['POST', '/api/password-reset/verify'],
    ]) {
      expect(findBackendMigrationRoute(method, routePath)).toBeNull();
    }
  });

  it('matches every method through the Learning OS Study proxy wildcard', () => {
    expect(
      findBackendMigrationRoute('PATCH', '/api/learning-os/study/cards/card-123')
    ).toMatchObject({
      route: { id: 'study.proxy', method: 'ALL' },
      surface: { id: 'study', runtimeOwner: 'learning-os-proxy' },
    });
  });

  it('does not inventory direct Learning OS feature-flag routes', () => {
    expect(findBackendMigrationRoute('GET', '/api/feature-flags')).toBeNull();
    expect(findBackendMigrationRoute('PATCH', '/api/feature-flags')).toBeNull();
    expect(findBackendMigrationRoute('GET', '/api/admin/feature-flags')).toBeNull();
    expect(findBackendMigrationRoute('PATCH', '/api/admin/feature-flags')).toBeNull();
  });

  it('does not inventory direct Learning OS media routes', () => {
    expect(findBackendMigrationRoute('GET', '/api/avatars/voices/ja-shohei.jpg')).toBeNull();
    expect(
      findBackendMigrationRoute(
        'GET',
        '/api/convolab/episodes/018f47ea-4b37-7f21-8d5a-90e157176b8a/audio/1.0'
      )
    ).toBeNull();
  });

  it('does not inventory the direct Learning OS tool-audio route', () => {
    expect(findBackendMigrationRoute('POST', '/api/tools-audio/signed-urls')).toBeNull();
  });

  it('does not classify unknown methods or paths', () => {
    expect(findBackendMigrationRoute('GET', '/api/episodes/episode-123')).toBeNull();
    expect(findBackendMigrationRoute('POST', '/api/episodes')).toBeNull();
    expect(findBackendMigrationRoute('POST', '/api/episodes/episode-123')).toBeNull();
    expect(findBackendMigrationRoute('GET', '/api/courses/course-123')).toBeNull();
    expect(findBackendMigrationRoute('POST', '/api/courses')).toBeNull();
    expect(findBackendMigrationRoute('GET', '/api/not-in-inventory')).toBeNull();
  });
});
