import express, {
  json as expressJson,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { errorHandler } from '../../../middleware/errorHandler.js';
import { mockPrisma } from '../../setup.js';

interface MockAuthRequest extends Request {
  userId?: string;
}

const mockRequireAuth = vi.hoisted(() =>
  vi.fn((req: MockAuthRequest, _res: Response, next: NextFunction) => {
    req.userId = 'user-1';
    next();
  })
);

vi.mock('../../../middleware/auth.js', () => ({
  requireAuth: mockRequireAuth,
}));

const featureFlags = {
  id: 'flag-1',
  dialoguesEnabled: true,
  scriptsEnabled: false,
  audioCourseEnabled: true,
  flashcardsEnabled: false,
  updatedAt: '2026-07-19T12:00:00.000Z',
};

describe('Feature Flags Route', () => {
  const originalLearningOsApiUrl = process.env.LEARNING_OS_API_URL;
  const originalLearningOsApiToken = process.env.LEARNING_OS_API_TOKEN;
  const originalLearningOsProxyUserEmail = process.env.LEARNING_OS_PROXY_USER_EMAIL;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    process.env.LEARNING_OS_API_URL = 'https://learning-os.example/';
    process.env.LEARNING_OS_API_TOKEN = 'server-only-token';
    process.env.LEARNING_OS_PROXY_USER_EMAIL = 'learner@example.com';
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'learner@example.com',
      role: 'user',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(featureFlags), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    );
  });

  afterEach(() => {
    process.env.LEARNING_OS_API_URL = originalLearningOsApiUrl;
    process.env.LEARNING_OS_API_TOKEN = originalLearningOsApiToken;
    process.env.LEARNING_OS_PROXY_USER_EMAIL = originalLearningOsProxyUserEmail;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function createApp() {
    const { default: featureFlagsRouter } = await import('../../../routes/featureFlags.js');
    const app = express();

    app.use(expressJson());
    app.use('/feature-flags', featureFlagsRouter);
    app.use(errorHandler);

    return app;
  }

  it('proxies the authenticated client contract with server-side identity headers', async () => {
    const app = await createApp();

    const response = await request(app).get('/feature-flags');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(featureFlags);
    expect(mockRequireAuth).toHaveBeenCalledOnce();
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { id: true, email: true, role: true },
    });
    expect(mockPrisma.featureFlag.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.featureFlag.create).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledOnce();

    const [url, init] = vi.mocked(global.fetch).mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('https://learning-os.example/api/feature-flags');
    expect(init).toMatchObject({
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer server-only-token',
        'X-Convo-Lab-User-Id': 'user-1',
        'X-Convo-Lab-User-Email': 'learner@example.com',
        'X-Convo-Lab-User-Role': 'user',
      },
    });
  });

  it('returns the all-enabled default row materialized by Learning OS', async () => {
    const defaults = {
      ...featureFlags,
      id: 'default',
      scriptsEnabled: true,
      flashcardsEnabled: true,
    };
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify(defaults), { status: 200 })
    );
    const app = await createApp();

    const response = await request(app).get('/feature-flags');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(defaults);
    expect(mockPrisma.featureFlag.create).not.toHaveBeenCalled();
  });

  it('projects away fields outside the established browser contract', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ ...featureFlags, internalValue: 'private' }), {
        status: 200,
      })
    );
    const app = await createApp();

    const response = await request(app).get('/feature-flags');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(featureFlags);
    expect(JSON.stringify(response.body)).not.toContain('private');
  });

  it('rejects requests when authentication does not supply a user id', async () => {
    mockRequireAuth.mockImplementationOnce(
      (_req: MockAuthRequest, _res: Response, next: NextFunction) => next()
    );
    const app = await createApp();

    const response = await request(app).get('/feature-flags');

    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe('Authentication required');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns a configuration error without falling back to Prisma', async () => {
    process.env.LEARNING_OS_API_TOKEN = '';
    const app = await createApp();

    const response = await request(app).get('/feature-flags');

    expect(response.status).toBe(503);
    expect(response.body.error.message).toBe(
      'Learning OS Feature Flags API is enabled but not configured.'
    );
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.featureFlag.findFirst).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects accounts other than the configured proxy user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-2',
      email: 'other@example.com',
      role: 'user',
    });
    const app = await createApp();

    const response = await request(app).get('/feature-flags');

    expect(response.status).toBe(403);
    expect(response.body.error.message).toBe(
      'Learning OS Feature Flags API is not enabled for this account.'
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns a hidden not-found response when the authenticated user no longer exists', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const app = await createApp();

    const response = await request(app).get('/feature-flags');

    expect(response.status).toBe(404);
    expect(response.body.error.message).toBe('User not found');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it.each([
    { value: null, label: 'null' },
    { value: { data: featureFlags }, label: 'wrapped' },
    { value: { ...featureFlags, id: '' }, label: 'blank id' },
    { value: { ...featureFlags, id: ' \t ' }, label: 'control id' },
    { value: { ...featureFlags, dialoguesEnabled: 'true' }, label: 'string boolean' },
    { value: { ...featureFlags, updatedAt: '2026-07-19T12:00:00Z' }, label: 'wrong precision' },
    { value: { ...featureFlags, updatedAt: '2026-07-19T12:00:00.000Zjunk' }, label: 'bad date' },
  ])('rejects an invalid $label upstream contract', async ({ value }) => {
    vi.mocked(global.fetch).mockResolvedValue(new Response(JSON.stringify(value), { status: 200 }));
    const app = await createApp();

    const response = await request(app).get('/feature-flags');

    expect(response.status).toBe(502);
    expect(response.body.error.message).toBe(
      'Learning OS Feature Flags API returned an invalid response.'
    );
  });

  it('returns a sanitized gateway error for invalid upstream JSON', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response('<html>private upstream response</html>', { status: 200 })
    );
    const app = await createApp();

    const response = await request(app).get('/feature-flags');

    expect(response.status).toBe(502);
    expect(response.body.error.message).toBe(
      'Learning OS Feature Flags API returned invalid JSON.'
    );
    expect(JSON.stringify(response.body)).not.toContain('private upstream response');
  });

  it.each([
    { upstreamStatus: 401, expectedStatus: 502 },
    { upstreamStatus: 403, expectedStatus: 403 },
    { upstreamStatus: 500, expectedStatus: 502 },
  ])(
    'maps upstream $upstreamStatus to a sanitized $expectedStatus response',
    async ({ upstreamStatus, expectedStatus }) => {
      vi.mocked(global.fetch).mockResolvedValue(
        new Response('private upstream failure', { status: upstreamStatus })
      );
      const app = await createApp();

      const response = await request(app).get('/feature-flags');

      expect(response.status).toBe(expectedStatus);
      expect(response.body.error.message).toBe('Learning OS Feature Flags API request failed.');
      expect(JSON.stringify(response.body)).not.toContain('private upstream failure');
    }
  );

  it('returns a gateway timeout when Learning OS hangs', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: URL, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      })
    );
    const app = await createApp();

    const pendingResponse = request(app)
      .get('/feature-flags')
      .then((response) => response);
    await vi.waitFor(() => expect(global.fetch).toHaveBeenCalledOnce());
    await vi.advanceTimersByTimeAsync(10_000);
    const response = await pendingResponse;

    expect(response.status).toBe(504);
    expect(response.body.error.message).toBe('Learning OS Feature Flags API request timed out.');
  });
});
