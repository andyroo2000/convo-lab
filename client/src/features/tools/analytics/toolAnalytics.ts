type ToolContext = 'public' | 'app';
type AnalyticsPrimitive = string | number | boolean | null;

const TOOL_ANALYTICS_ENDPOINT = '/api/tools/analytics';
const SESSION_STORAGE_KEY = 'convolab:tools:analytics-session-id';
const MAX_EVENT_PROPERTIES = 16;
const MAX_PROPERTY_KEY_LENGTH = 40;
const MAX_PROPERTY_VALUE_LENGTH = 120;

let cachedSessionId: string | null = null;

function getToolContext(pathname: string): ToolContext {
  return pathname.startsWith('/app/') ? 'app' : 'public';
}

function createSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `anon_${Math.random().toString(36).slice(2, 14)}`;
}

function getSessionId(): string {
  if (cachedSessionId) {
    return cachedSessionId;
  }

  if (typeof window === 'undefined') {
    cachedSessionId = createSessionId();
    return cachedSessionId;
  }

  const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) {
    cachedSessionId = existing;
    return existing;
  }

  const next = createSessionId();
  window.localStorage.setItem(SESSION_STORAGE_KEY, next);
  cachedSessionId = next;
  return next;
}

function sanitizeProperties(
  properties: Record<string, AnalyticsPrimitive> | undefined
): Record<string, AnalyticsPrimitive> {
  if (!properties) {
    return {};
  }

  return Object.entries(properties)
    .slice(0, MAX_EVENT_PROPERTIES)
    .reduce<Record<string, AnalyticsPrimitive>>((acc, [key, value]) => {
      if (!/^[a-z0-9:_-]+$/i.test(key) || key.length > MAX_PROPERTY_KEY_LENGTH) {
        return acc;
      }

      if (typeof value === 'string') {
        acc[key] = value.slice(0, MAX_PROPERTY_VALUE_LENGTH);
        return acc;
      }

      if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
        acc[key] = value;
      }

      return acc;
    }, {});
}

export default function trackToolEvent(input: {
  tool: string;
  event: string;
  mode?: 'fsrs' | 'random';
  properties?: Record<string, AnalyticsPrimitive>;
}): void {
  if (typeof window === 'undefined') {
    return;
  }

  const payload = {
    tool: input.tool,
    event: input.event,
    mode: input.mode,
    context: getToolContext(window.location.pathname),
    sessionId: getSessionId(),
    properties: sanitizeProperties(input.properties),
  };
  const body = JSON.stringify(payload);

  if (typeof navigator.sendBeacon === 'function') {
    const accepted = navigator.sendBeacon(
      TOOL_ANALYTICS_ENDPOINT,
      new Blob([body], { type: 'application/json' })
    );
    if (accepted) {
      return;
    }
  }

  if (typeof fetch !== 'function') {
    return;
  }

  fetch(TOOL_ANALYTICS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    keepalive: true,
    body,
  }).catch(() => {
    // Fire-and-forget analytics should never interrupt user actions.
  });
}
