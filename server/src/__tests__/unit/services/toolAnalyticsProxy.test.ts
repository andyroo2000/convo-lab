import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { recordLearningOsToolAnalytics } from '../../../services/toolAnalyticsProxy.js';
import { mockPrisma } from '../../setup.js';

const event = {
  tool: 'japanese-time-practice',
  event: 'fsrs_graded',
  context: 'public' as const,
  mode: 'fsrs' as const,
  sessionId: 'anon_abc123',
  properties: {
    grade: 'good',
    reveal_delay: 8,
  },
};

describe('Tool Analytics Proxy Service', () => {
  const originalLearningOsApiUrl = process.env.LEARNING_OS_API_URL;
  const originalLearningOsApiToken = process.env.LEARNING_OS_API_TOKEN;
  const originalLearningOsProxyUserEmail = process.env.LEARNING_OS_PROXY_USER_EMAIL;

  beforeEach(() => {
    process.env.LEARNING_OS_API_URL = 'https://learning-os.example/';
    process.env.LEARNING_OS_API_TOKEN = 'server-only-token';
    delete process.env.LEARNING_OS_PROXY_USER_EMAIL;
  });

  afterEach(() => {
    process.env.LEARNING_OS_API_URL = originalLearningOsApiUrl;
    process.env.LEARNING_OS_API_TOKEN = originalLearningOsApiToken;
    process.env.LEARNING_OS_PROXY_USER_EMAIL = originalLearningOsProxyUserEmail;
    vi.unstubAllGlobals();
  });

  it('forwards the bounded event with only the service bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(recordLearningOsToolAnalytics(event)).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('https://learning-os.example/api/convolab/tools/analytics');
    expect(init).toMatchObject({
      method: 'POST',
      body: JSON.stringify(event),
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer server-only-token',
        'Content-Type': 'application/json',
      },
    });
    expect(init.headers).not.toHaveProperty('X-Convo-Lab-User-Id');
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('does not require the unrelated browser-user proxy email', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    await expect(recordLearningOsToolAnalytics(event)).resolves.toBeUndefined();
  });

  it.each([200, 401, 403, 422, 429, 500])(
    'maps unexpected upstream status %i to a gateway error',
    async (status) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status })));

      await expect(recordLearningOsToolAnalytics(event)).rejects.toMatchObject({
        statusCode: 502,
        message: 'Learning OS Tool Analytics API request failed.',
      });
    }
  );

  it('maps network failures to an unavailable gateway error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('connection refused')));

    await expect(recordLearningOsToolAnalytics(event)).rejects.toMatchObject({
      statusCode: 502,
      message: 'Learning OS Tool Analytics API is unavailable.',
    });
  });
});
