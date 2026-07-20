import { BACKEND_ROUTE_USAGE_EVENT, BackendRouteUsageEvent } from './backendRouteUsage.js';

export interface BackendRouteUsageSummary {
  routeId: string;
  surfaceId: string;
  domain: string;
  migrationWave: string;
  runtimeOwner: string;
  method: string;
  normalizedPath: string;
  requests: number;
  errors: number;
  maxDurationMs: number;
  p95DurationMs: number;
  statusCodes: Record<string, number>;
}

const parseEvent = (line: string): BackendRouteUsageEvent | null => {
  const jsonStart = line.indexOf('{');
  if (jsonStart === -1) return null;

  try {
    const value = JSON.parse(line.slice(jsonStart)) as Partial<BackendRouteUsageEvent>;
    if (
      value.event !== BACKEND_ROUTE_USAGE_EVENT ||
      value.schemaVersion !== 1 ||
      typeof value.routeId !== 'string' ||
      typeof value.surfaceId !== 'string' ||
      typeof value.domain !== 'string' ||
      typeof value.migrationWave !== 'string' ||
      typeof value.runtimeOwner !== 'string' ||
      typeof value.method !== 'string' ||
      typeof value.normalizedPath !== 'string' ||
      typeof value.statusCode !== 'number' ||
      !Number.isInteger(value.statusCode) ||
      value.statusCode < 100 ||
      value.statusCode > 599 ||
      typeof value.durationMs !== 'number' ||
      !Number.isFinite(value.durationMs) ||
      value.durationMs < 0
    ) {
      return null;
    }

    return value as BackendRouteUsageEvent;
  } catch {
    return null;
  }
};

export const summarizeBackendRouteUsage = (lines: Iterable<string>): BackendRouteUsageSummary[] => {
  const groups = new Map<
    string,
    {
      event: BackendRouteUsageEvent;
      durations: number[];
      errors: number;
      statusCodes: Record<string, number>;
    }
  >();

  for (const line of lines) {
    const event = parseEvent(line);
    if (!event) continue;

    const key = `${event.method}\0${event.routeId}`;
    const group = groups.get(key) ?? {
      event,
      durations: [],
      errors: 0,
      statusCodes: {},
    };
    group.durations.push(event.durationMs);
    if (event.statusCode >= 400) group.errors += 1;

    const statusCode = String(event.statusCode);
    group.statusCodes[statusCode] = (group.statusCodes[statusCode] ?? 0) + 1;
    groups.set(key, group);
  }

  return [...groups.values()]
    .map(({ event, durations, errors, statusCodes }) => {
      const sortedDurations = [...durations].sort((left, right) => left - right);
      const p95Index = Math.max(0, Math.ceil(sortedDurations.length * 0.95) - 1);

      return {
        routeId: event.routeId,
        surfaceId: event.surfaceId,
        domain: event.domain,
        migrationWave: event.migrationWave,
        runtimeOwner: event.runtimeOwner,
        method: event.method,
        normalizedPath: event.normalizedPath,
        requests: durations.length,
        errors,
        maxDurationMs: sortedDurations.at(-1) ?? 0,
        p95DurationMs: sortedDurations[p95Index] ?? 0,
        statusCodes,
      };
    })
    .sort(
      (left, right) =>
        right.requests - left.requests ||
        left.surfaceId.localeCompare(right.surfaceId) ||
        left.routeId.localeCompare(right.routeId)
    );
};
