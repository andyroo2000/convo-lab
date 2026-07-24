import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ENDPOINT = '/api/convolab/browser/tools/analytics';

describe('tool analytics', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.history.replaceState({}, '', '/tools/japanese-time');
    vi.stubGlobal('crypto', { randomUUID: () => '11111111-1111-4111-8111-111111111111' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the canonical bounded payload through sendBeacon', async () => {
    const sendBeacon = vi.fn(() => true);
    const fetchMock = vi.fn();
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      value: sendBeacon,
    });
    vi.stubGlobal('fetch', fetchMock);
    const { default: trackToolEvent } = await import('./toolAnalytics');

    trackToolEvent({
      tool: 'japanese:time',
      event: 'answer_passed',
      mode: 'fsrs',
      properties: { correct: true },
    });

    expect(sendBeacon).toHaveBeenCalledWith(ENDPOINT, expect.any(Blob));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to a keepalive fetch and sanitizes event properties', async () => {
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      value: vi.fn(() => false),
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const { default: trackToolEvent } = await import('./toolAnalytics');

    trackToolEvent({
      tool: 'japanese:time',
      event: 'answer_passed',
      properties: {
        safe_key: 'x'.repeat(130),
        'unsafe key': 'discarded',
        score: 0.98,
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(ENDPOINT);
    expect(init).toMatchObject({
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
    });
    expect(JSON.parse(String(init.body))).toEqual({
      tool: 'japanese:time',
      event: 'answer_passed',
      context: 'public',
      sessionId: '11111111-1111-4111-8111-111111111111',
      properties: {
        safe_key: 'x'.repeat(120),
        score: 0.98,
      },
    });
  });

  it('marks authenticated app paths with the app context', async () => {
    window.history.replaceState({}, '', '/app/tools/japanese-time');
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      value: vi.fn(() => false),
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const { default: trackToolEvent } = await import('./toolAnalytics');

    trackToolEvent({
      tool: 'japanese:time',
      event: 'session_started',
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({ context: 'app' });
  });
});
