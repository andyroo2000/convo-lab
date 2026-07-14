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
  const originalJwtSecret = process.env.JWT_SECRET;

  function createApp() {
    const app = express();
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

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
    process.env.LEARNING_OS_API_URL = 'https://learning-os.example';
    process.env.LEARNING_OS_API_TOKEN = 'server-only-token';
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
  });

  afterEach(() => {
    process.env.LEARNING_OS_API_URL = originalLearningOsApiUrl;
    process.env.LEARNING_OS_API_TOKEN = originalLearningOsApiToken;
    process.env.JWT_SECRET = originalJwtSecret;
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
      onBackendError: 'fail-closed',
    });
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

  it('rejects routes outside the read-only Study API allowlist', async () => {
    const app = await createApp();

    const response = await request(app)
      .get('/api/learning-os/study/cards/card-1/actions')
      .set('Cookie', authCookie());

    expect(response.status).toBe(404);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
