import cookieParser from 'cookie-parser';
import express, {
  json as expressJson,
  type ErrorRequestHandler,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { sign as signJwt } from 'jsonwebtoken';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  featureFlag: {
    findFirst: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
}));

const mockRateLimitStudyRoute = vi.hoisted(() =>
  vi.fn((_options) => (_req: Request, _res: Response, next: NextFunction) => next())
);

vi.mock('../../../../db/client.js', () => ({ prisma: mockPrisma }));
vi.mock('../../../../middleware/studyRateLimit.js', () => ({
  rateLimitStudyRoute: mockRateLimitStudyRoute,
}));

describe('Learning OS Study proxy routes', () => {
  const originalLearningOsApiUrl = process.env.LEARNING_OS_API_URL;
  const originalLearningOsApiToken = process.env.LEARNING_OS_API_TOKEN;
  const originalLearningOsProxyUserEmail = process.env.LEARNING_OS_PROXY_USER_EMAIL;
  const originalJwtSecret = process.env.JWT_SECRET;

  function createApp() {
    const app = express();
    app.set('query parser', 'extended');
    app.use(cookieParser());
    app.use(expressJson());

    return import('../../../../routes/learningOs/study.js').then(
      ({ default: learningOsStudyRoutes }) => {
        app.use('/api/learning-os/study', learningOsStudyRoutes);
        app.use(((error: unknown, _req, res, _next) => {
          const appError = error as { statusCode?: number; message?: string };
          res.status(appError.statusCode ?? 500).json({
            error: { message: appError.message ?? 'Unexpected error' },
          });
        }) as ErrorRequestHandler);
        return app;
      }
    );
  }

  function authCookie(userId = 'user-1'): string {
    const token = signJwt({ userId, role: 'user' }, process.env.JWT_SECRET as string);
    return `token=${token}`;
  }

  const enabledStudyApiFlags = {
    dialoguesEnabled: true,
    scriptsEnabled: true,
    audioCourseEnabled: true,
    flashcardsEnabled: true,
    studyApiEnabled: true,
    studyApiSettings: true,
    studyApiOverview: true,
    studyApiBrowser: true,
    studyApiNewQueue: true,
    studyApiImports: true,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useRealTimers();
    const { resetFeatureFlagCacheForTests } =
      await import('../../../../middleware/featureFlags.js');
    resetFeatureFlagCacheForTests();
    process.env.JWT_SECRET = 'test-secret';
    process.env.LEARNING_OS_API_URL = 'https://learning-os.example';
    process.env.LEARNING_OS_API_TOKEN = 'server-only-token';
    process.env.LEARNING_OS_PROXY_USER_EMAIL = 'learner@example.com';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    );
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'learner@example.com',
      role: 'user',
    });
    mockPrisma.featureFlag.findFirst.mockResolvedValue(enabledStudyApiFlags);
  });

  afterEach(() => {
    process.env.LEARNING_OS_API_URL = originalLearningOsApiUrl;
    process.env.LEARNING_OS_API_TOKEN = originalLearningOsApiToken;
    process.env.LEARNING_OS_PROXY_USER_EMAIL = originalLearningOsProxyUserEmail;
    process.env.JWT_SECRET = originalJwtSecret;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('proxies allowed study reads with server-side auth and user identity headers', async () => {
    const app = await createApp();

    const response = await request(app)
      .get('/api/learning-os/study/browser?sortField=created_on&limit=25')
      .set('Cookie', authCookie());

    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const [url, init] = vi.mocked(global.fetch).mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(
      'https://learning-os.example/api/study/browser?sortField=created_on&limit=25'
    );
    expect(init.method).toBe('GET');
    expect(init.headers).toMatchObject({
      Accept: 'application/json',
      Authorization: 'Bearer server-only-token',
      'X-Convo-Lab-User-Id': 'user-1',
      'X-Convo-Lab-User-Email': 'learner@example.com',
      'X-Convo-Lab-User-Role': 'user',
    });
    expect(mockRateLimitStudyRoute).toHaveBeenCalledWith({
      key: 'learning-os-read-proxy',
      max: 240,
      windowMs: 60 * 1000,
    });
    expect(mockRateLimitStudyRoute).toHaveBeenCalledWith({
      key: 'learning-os-import-proxy',
      max: 240,
      windowMs: 60 * 1000,
      onBackendError: 'fail-closed',
    });
  });

  it('serializes successful upstream responses as JSON instead of forwarding content type', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'text/html' },
        })
      )
    );
    const app = await createApp();

    const response = await request(app)
      .get('/api/learning-os/study/overview')
      .set('Cookie', authCookie());

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.body).toEqual({ ok: true });
  });

  it('adapts Laravel study settings to the existing ConvoLab response contract', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              new_cards_per_day: 17,
              created_at: '2026-07-15T12:00:00.000000Z',
              updated_at: '2026-07-15T12:00:00.000000Z',
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )
    );
    const app = await createApp();

    const response = await request(app)
      .get('/api/learning-os/study/settings')
      .set('Cookie', authCookie());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ newCardsPerDay: 17 });
  });

  it('rejects malformed Laravel study settings instead of leaking an incompatible shape', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: { new_cards_per_day: '17' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    );
    const app = await createApp();

    const response = await request(app)
      .get('/api/learning-os/study/settings')
      .set('Cookie', authCookie());

    expect(response.status).toBe(502);
    expect(response.body.error.message).toBe(
      'Learning OS Study API returned an invalid settings response.'
    );
  });

  it('returns a sanitized gateway error when Learning OS returns invalid JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('<html>upstream error page</html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        })
      )
    );
    const app = await createApp();

    const response = await request(app)
      .get('/api/learning-os/study/overview')
      .set('Cookie', authCookie());

    expect(response.status).toBe(502);
    expect(response.body.error.message).toBe(
      'Learning OS Study API returned an invalid JSON response.'
    );
    expect(JSON.stringify(response.body)).not.toContain('upstream error page');
  });

  it('returns a configuration error without falling back when upstream config is missing', async () => {
    process.env.LEARNING_OS_API_TOKEN = '';
    const app = await createApp();

    const response = await request(app)
      .get('/api/learning-os/study/settings')
      .set('Cookie', authCookie());

    expect(response.status).toBe(503);
    expect(response.body.error.message).toBe(
      'Learning OS Study API is enabled but not configured.'
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects accounts other than the user represented by the initial proxy token', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-2',
      email: 'other@example.com',
      role: 'user',
    });
    const app = await createApp();

    const response = await request(app)
      .get('/api/learning-os/study/settings')
      .set('Cookie', authCookie('user-2'));

    expect(response.status).toBe(403);
    expect(response.body.error.message).toBe(
      'Learning OS Study API is not enabled for this account.'
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects direct proxy reads when the parent Study API flag is disabled', async () => {
    mockPrisma.featureFlag.findFirst.mockResolvedValue({
      ...enabledStudyApiFlags,
      studyApiEnabled: false,
    });
    const app = await createApp();

    const response = await request(app)
      .get('/api/learning-os/study/browser')
      .set('Cookie', authCookie());

    expect(response.status).toBe(403);
    expect(response.body.error.message).toBe('Learning OS Study API route is not enabled.');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects direct proxy reads when the endpoint Study API flag is disabled', async () => {
    mockPrisma.featureFlag.findFirst.mockResolvedValue({
      ...enabledStudyApiFlags,
      studyApiBrowser: false,
    });
    const app = await createApp();

    const response = await request(app)
      .get('/api/learning-os/study/browser')
      .set('Cookie', authCookie());

    expect(response.status).toBe(403);
    expect(response.body.error.message).toBe('Learning OS Study API route is not enabled.');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects query params that are not allowed for the proxied route', async () => {
    const app = await createApp();

    const response = await request(app)
      .get('/api/learning-os/study/settings?cursor=not-allowed')
      .set('Cookie', authCookie());

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe(
      'Query parameter "cursor" is not allowed for this Study API route.'
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects allowed query params with nested object values', async () => {
    const app = await createApp();

    const response = await request(app)
      .get('/api/learning-os/study/browser?q[foo]=bar')
      .set('Cookie', authCookie());

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe(
      'Query parameter "q" must be a string or list of strings.'
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns a gateway timeout when the upstream Learning OS request hangs', async () => {
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
      .get('/api/learning-os/study/overview?timeZone=America%2FNew_York')
      .set('Cookie', authCookie())
      .then((response) => response);
    await vi.waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(10_000);
    const response = await pendingResponse;

    expect(response.status).toBe(504);
    expect(response.body.error.message).toBe('Learning OS Study API request timed out.');
  });

  it('rejects unsafe import id path segments before building the upstream URL', async () => {
    const app = await createApp();

    const response = await request(app)
      .get('/api/learning-os/study/imports/..')
      .set('Cookie', authCookie());

    expect(response.status).toBe(404);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns a sanitized error when Learning OS returns a non-2xx response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ stack: 'internal upstream details' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        })
      )
    );
    const app = await createApp();

    const response = await request(app)
      .get('/api/learning-os/study/imports/import_123')
      .set('Cookie', authCookie());

    expect(response.status).toBe(502);
    expect(response.body.error.message).toBe('Learning OS Study API request failed.');
    expect(JSON.stringify(response.body)).not.toContain('internal upstream details');
  });

  it('rejects routes outside the read-only Study API allowlist', async () => {
    const app = await createApp();

    const response = await request(app)
      .get('/api/learning-os/study/cards/card-1/actions')
      .set('Cookie', authCookie());

    expect(response.status).toBe(404);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
