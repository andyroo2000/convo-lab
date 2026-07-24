import { describe, expect, it } from 'vitest';

import { buildBackendRouteUsageEvent } from '../../../migration/backendRouteUsage.js';
import { summarizeBackendRouteUsage } from '../../../migration/backendRouteUsageReport.js';

describe('backend route usage telemetry', () => {
  it('ignores non-API requests', () => {
    expect(buildBackendRouteUsageEvent('GET', '/health', 200, 5)).toBeNull();
  });

  it('aggregates valid events while ignoring unrelated and malformed log lines', () => {
    const first = buildBackendRouteUsageEvent(
      'GET',
      '/api/admin/script-lab/courses/first-id',
      200,
      10
    );
    const second = buildBackendRouteUsageEvent(
      'GET',
      '/api/admin/script-lab/courses/second-id',
      500,
      40
    );
    const third = buildBackendRouteUsageEvent('GET', '/api/feature-flags', 200, 20);

    const result = summarizeBackendRouteUsage([
      'ordinary request log',
      JSON.stringify(first),
      `container-prefix ${JSON.stringify(second)}`,
      '{broken json',
      JSON.stringify({ ...third, durationMs: -1 }),
      JSON.stringify({ ...third, statusCode: 999 }),
      JSON.stringify(third),
    ]);

    expect(result).toEqual([
      {
        routeId: 'admin-script-lab.courses.show',
        surfaceId: 'admin-script-lab',
        domain: 'admin',
        migrationWave: 'admin',
        runtimeOwner: 'learning-os-proxy',
        method: 'GET',
        normalizedPath: '/api/admin/script-lab/courses/:id',
        requests: 2,
        errors: 1,
        maxDurationMs: 40,
        p95DurationMs: 40,
        statusCodes: { '200': 1, '500': 1 },
      },
      {
        routeId: 'feature-flags.show',
        surfaceId: 'feature-flags',
        domain: 'configuration',
        migrationWave: 'pattern',
        runtimeOwner: 'learning-os-proxy',
        method: 'GET',
        normalizedPath: '/api/feature-flags',
        requests: 1,
        errors: 0,
        maxDurationMs: 20,
        p95DurationMs: 20,
        statusCodes: { '200': 1 },
      },
    ]);
  });

  it('keeps unclassified traffic visible without retaining its concrete path', () => {
    const event = buildBackendRouteUsageEvent('GET', '/api/private/user-123', 404, 3);

    expect(event).toMatchObject({
      routeId: 'unclassified',
      normalizedPath: 'unclassified',
    });
    expect(JSON.stringify(event)).not.toContain('user-123');
  });
});
