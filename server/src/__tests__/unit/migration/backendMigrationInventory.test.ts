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
    expect(routes.length).toBeGreaterThan(56);
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

  it('has no routes still owned by Express', () => {
    const expressRouteIds = backendMigrationInventory.surfaces.flatMap((surface) =>
      surface.routes
        .filter((route) => (route.runtimeOwner ?? surface.runtimeOwner) === 'express')
        .map((route) => route.id)
    );

    expect(expressRouteIds).toEqual([]);
  });

  it('resolves concrete dynamic paths to stable inventory routes', () => {
    expect(findBackendMigrationRoute('POST', '/api/tools/analytics')).toMatchObject({
      route: { id: 'tool-analytics.store' },
      surface: { id: 'tool-analytics', runtimeOwner: 'learning-os-proxy' },
    });
    expect(findBackendMigrationRoute('POST', '/api/audio/generate-all-speeds')).toMatchObject({
      route: { id: 'audio.generate-all-speeds' },
      surface: { id: 'audio', runtimeOwner: 'learning-os-proxy' },
    });
    expect(
      findBackendMigrationRoute(
        'GET',
        '/api/scripts/018f47ea-4b37-7f21-8d5a-90e157176b8a/audio/019c8e84-f73f-78e8-96e8-c5b462053ee0'
      )
    ).toMatchObject({
      route: { id: 'scripts.audio.show' },
      surface: { id: 'scripts', runtimeOwner: 'learning-os-proxy' },
    });
    expect(findBackendMigrationRoute('POST', '/api/images/generate')).toMatchObject({
      route: { id: 'images.generate' },
      surface: { id: 'images', runtimeOwner: 'learning-os-proxy' },
    });
    expect(
      findBackendMigrationRoute('GET', '/api/images/job/019c8e7f-5c48-7d32-ae6b-a1f268287c9b')
    ).toMatchObject({
      route: { id: 'images.job.show' },
      surface: { id: 'images', runtimeOwner: 'learning-os-proxy' },
    });
    expect(
      findBackendMigrationRoute(
        'GET',
        '/api/convolab/episodes/018f47ea-4b37-7f21-8d5a-90e157176b8a/audio/1.0'
      )
    ).toMatchObject({
      route: { id: 'content-episode-audio.show' },
      surface: { id: 'content-episode-audio', runtimeOwner: 'learning-os-proxy' },
    });
    expect(findBackendMigrationRoute('DELETE', '/api/admin/invite-codes/invite-123')).toMatchObject(
      {
        route: { id: 'admin.invites.delete' },
        surface: { id: 'admin', migrationWave: 'admin' },
      }
    );
  });

  it('tracks migrated admin routes as Learning OS proxies', () => {
    for (const [method, routePath] of [
      ['GET', '/api/admin/stats'],
      ['GET', '/api/admin/users'],
      ['GET', '/api/admin/users/11111111-1111-4111-8111-111111111111/info'],
      ['GET', '/api/admin/invite-codes'],
      ['GET', '/api/admin/avatars/speaker/ja-female-casual.jpg/original'],
      ['GET', '/api/admin/avatars/speakers'],
      ['GET', '/api/admin/pronunciation-dictionaries'],
      ['PUT', '/api/admin/pronunciation-dictionaries'],
    ]) {
      expect(findBackendMigrationRoute(method, routePath)).toMatchObject({
        surface: { id: 'admin', runtimeOwner: 'learning-os-proxy' },
      });
    }

    for (const [method, routePath] of [
      ['DELETE', '/api/admin/users/11111111-1111-4111-8111-111111111111'],
      ['POST', '/api/admin/invite-codes'],
      ['DELETE', '/api/admin/invite-codes/22222222-2222-4222-8222-222222222222'],
      ['POST', '/api/admin/avatars/speaker/ja-female-casual.jpg/upload'],
      ['POST', '/api/admin/avatars/speaker/ja-female-casual.jpg/recrop'],
      ['POST', '/api/admin/avatars/user/11111111-1111-4111-8111-111111111111/upload'],
    ]) {
      expect(findBackendMigrationRoute(method, routePath)).toMatchObject({
        surface: { id: 'admin', runtimeOwner: 'learning-os-proxy' },
      });
    }
  });

  it('tracks the admin course and Script Lab course surfaces through Learning OS', () => {
    for (const [method, routePath] of [
      ['POST', `/api/admin/courses/${'4'.repeat(36)}/build-prompt`],
      ['POST', `/api/admin/courses/${'4'.repeat(36)}/synthesize-line`],
      ['GET', `/api/admin/courses/${'4'.repeat(36)}/line-renderings`],
      ['GET', `/api/admin/courses/${'4'.repeat(36)}/line-renderings/${'5'.repeat(36)}/audio`],
      ['DELETE', `/api/admin/courses/${'4'.repeat(36)}/line-renderings/${'5'.repeat(36)}`],
    ]) {
      expect(findBackendMigrationRoute(method, routePath)).toMatchObject({
        surface: { id: 'admin-courses', runtimeOwner: 'learning-os-proxy' },
      });
    }

    for (const [method, routePath] of [
      ['POST', '/api/admin/script-lab/courses'],
      ['GET', '/api/admin/script-lab/courses'],
      ['GET', `/api/admin/script-lab/courses/${'4'.repeat(36)}`],
      ['DELETE', '/api/admin/script-lab/courses'],
      ['POST', '/api/admin/script-lab/sentence-script'],
      ['GET', '/api/admin/script-lab/sentence-tests'],
      ['GET', `/api/admin/script-lab/sentence-tests/${'6'.repeat(36)}`],
      ['DELETE', '/api/admin/script-lab/sentence-tests'],
      ['POST', '/api/admin/script-lab/test-pronunciation'],
      ['POST', '/api/admin/script-lab/synthesize-line'],
      ['GET', `/api/admin/script-lab/audio/${'7'.repeat(36)}`],
    ]) {
      expect(findBackendMigrationRoute(method, routePath)).toMatchObject({
        surface: { id: 'admin-script-lab', runtimeOwner: 'learning-os-proxy' },
      });
    }
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
    expect(findBackendMigrationRoute('GET', '/api/episodes/episode-123')).toBeNull();
    expect(findBackendMigrationRoute('POST', '/api/episodes')).toBeNull();
    expect(findBackendMigrationRoute('POST', '/api/episodes/episode-123')).toBeNull();
    expect(findBackendMigrationRoute('GET', '/api/courses/course-123')).toBeNull();
    expect(findBackendMigrationRoute('POST', '/api/courses')).toBeNull();
    expect(findBackendMigrationRoute('GET', '/api/not-in-inventory')).toBeNull();
  });
});
