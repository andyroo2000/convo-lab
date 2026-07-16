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

import {
  CSRF_TOKEN_COOKIE_NAME,
  CSRF_TOKEN_HEADER_NAME,
  apiCsrfErrorHandler,
  issueCsrfTokenCookie,
  requireApiCsrfProtection,
} from '../../../../middleware/csrf.js';
import { resetBrowserRuntimeTestState } from '../../../helpers/browserRuntimeTestHelper.js';
import { getSetCookieArray } from '../../../helpers/testCookieParser.js';

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
  const originalClientUrl = process.env.CLIENT_URL;

  const emptyBrowserResponse = {
    rows: [],
    total: 0,
    limit: 50,
    nextCursor: null,
    filterOptions: { noteTypes: [], cardTypes: [], queueStates: [] },
  };

  const browserDetailResponse = {
    noteId: 'note-1',
    displayText: '会社',
    noteTypeName: 'Japanese - Vocab',
    sourceKind: 'anki_import',
    updatedAt: '2026-07-15T12:00:00.000000Z',
    rawFields: [],
    canonicalFields: [],
    cards: [],
    cardStats: [],
    selectedCardId: null,
  };

  const emptyOverviewResponse = {
    data: {
      due_count: 0,
      failed_count: 0,
      new_count: 0,
      new_cards_per_day: 20,
      new_cards_introduced_today: 0,
      new_cards_available_today: 0,
      learning_count: 0,
      review_count: 0,
      suspended_count: 0,
      total_cards: 0,
      latest_import: null,
      next_due_at: null,
    },
  };

  const newQueueResponse = {
    items: [
      {
        id: 'card-1',
        noteId: 'note-1',
        cardType: 'recognition',
        displayText: '会社',
        meaning: 'company',
        queuePosition: 2,
        createdAt: '2026-07-15T12:00:00.000000Z',
        updatedAt: '2026-07-15T13:00:00.000000Z',
      },
    ],
    total: 1,
    limit: 25,
    nextCursor: null,
  };

  function createApp() {
    const app = express();
    app.set('query parser', 'extended');
    app.use(cookieParser());
    app.use(expressJson());
    app.get('/api/auth/csrf', (req, res) => {
      issueCsrfTokenCookie(req, res, 'lax');
      res.sendStatus(204);
    });
    app.use('/api/learning-os/study', requireApiCsrfProtection);

    return import('../../../../routes/learningOs/study.js').then(
      ({ default: learningOsStudyRoutes }) => {
        app.use('/api/learning-os/study', learningOsStudyRoutes);
        app.use(apiCsrfErrorHandler);
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

  async function csrfAuth(app: express.Application, userId = 'user-1') {
    const auth = authCookie(userId);
    const csrfResponse = await request(app)
      .get('/api/auth/csrf')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', auth);
    const cookies = getSetCookieArray(csrfResponse.headers['set-cookie']);
    const tokenCookie = cookies
      .map((value) => value.split(';')[0])
      .find((value) => value.startsWith(`${CSRF_TOKEN_COOKIE_NAME}=`));
    const token = tokenCookie
      ? decodeURIComponent(tokenCookie.slice(`${CSRF_TOKEN_COOKIE_NAME}=`.length))
      : '';

    return { cookies: [auth, ...cookies], token };
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
    studyApiBrowserDetail: true,
    studyApiNewQueue: true,
    studyApiImports: true,
    studyApiSettingsWrite: true,
    studyApiNewQueueWrite: true,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useRealTimers();
    const { resetFeatureFlagCacheForTests } =
      await import('../../../../middleware/featureFlags.js');
    resetFeatureFlagCacheForTests();
    process.env.JWT_SECRET = 'test-secret';
    process.env.CLIENT_URL = 'http://localhost:5173';
    resetBrowserRuntimeTestState();
    process.env.LEARNING_OS_API_URL = 'https://learning-os.example';
    process.env.LEARNING_OS_API_TOKEN = 'server-only-token';
    process.env.LEARNING_OS_PROXY_USER_EMAIL = 'learner@example.com';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(emptyBrowserResponse), {
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
    process.env.CLIENT_URL = originalClientUrl;
    resetBrowserRuntimeTestState();
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
    expect(mockRateLimitStudyRoute).toHaveBeenCalledWith({
      key: 'learning-os-settings-write-proxy',
      max: 60,
      windowMs: 60 * 1000,
      onBackendError: 'fail-closed',
    });
    expect(mockRateLimitStudyRoute).toHaveBeenCalledWith({
      key: 'learning-os-new-queue-write-proxy',
      max: 60,
      windowMs: 60 * 1000,
      onBackendError: 'fail-closed',
    });
  });

  it('proxies Browser detail through its independent flag without query parameters', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(browserDetailResponse), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    );
    const app = await createApp();

    const response = await request(app)
      .get('/api/learning-os/study/browser/note-1')
      .set('Cookie', authCookie());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ...browserDetailResponse,
      updatedAt: '2026-07-15T12:00:00.000Z',
    });
    const [url] = vi.mocked(global.fetch).mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('https://learning-os.example/api/study/browser/note-1');
  });

  it('keeps Browser detail disabled independently from Browser list', async () => {
    mockPrisma.featureFlag.findFirst.mockResolvedValue({
      ...enabledStudyApiFlags,
      studyApiBrowser: true,
      studyApiBrowserDetail: false,
    });
    const app = await createApp();

    const response = await request(app)
      .get('/api/learning-os/study/browser/note-1')
      .set('Cookie', authCookie());

    expect(response.status).toBe(403);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects Browser detail query parameters before calling Learning OS', async () => {
    const app = await createApp();

    const response = await request(app)
      .get('/api/learning-os/study/browser/note-1?limit=1')
      .set('Cookie', authCookie());

    expect(response.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('serializes successful upstream responses as JSON instead of forwarding content type', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(emptyOverviewResponse), {
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
    expect(response.body).toEqual({
      dueCount: 0,
      failedCount: 0,
      newCount: 0,
      newCardsPerDay: 20,
      newCardsIntroducedToday: 0,
      newCardsAvailableToday: 0,
      learningCount: 0,
      reviewCount: 0,
      suspendedCount: 0,
      totalCards: 0,
      latestImport: null,
      nextDueAt: null,
    });
  });

  it('translates the ConvoLab overview timezone query to the Laravel contract', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(emptyOverviewResponse), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    );
    const app = await createApp();

    const response = await request(app)
      .get('/api/learning-os/study/overview?timeZone=America%2FNew_York')
      .set('Cookie', authCookie());

    expect(response.status).toBe(200);
    const [url] = vi.mocked(global.fetch).mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(
      'https://learning-os.example/api/study/overview?time_zone=America%2FNew_York'
    );
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

  it('proxies settings writes with CSRF protection and the Laravel request contract', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: { new_cards_per_day: 23 } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    );
    const app = await createApp();
    const { cookies, token } = await csrfAuth(app);

    const response = await request(app)
      .patch('/api/learning-os/study/settings')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies)
      .set(CSRF_TOKEN_HEADER_NAME, token)
      .send({ newCardsPerDay: 23 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ newCardsPerDay: 23 });
    const [url, init] = vi.mocked(global.fetch).mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('https://learning-os.example/api/study/settings');
    expect(init.method).toBe('PATCH');
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
    expect(JSON.parse(String(init.body))).toEqual({ new_cards_per_day: 23 });
  });

  it('proxies normalized New Queue reorders without forwarding client headers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(newQueueResponse), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    );
    const app = await createApp();
    const { cookies, token } = await csrfAuth(app);
    const cardId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

    const response = await request(app)
      .post('/api/learning-os/study/new-queue/reorder')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies)
      .set(CSRF_TOKEN_HEADER_NAME, token)
      .set('X-Client-Secret', 'do-not-forward')
      .send({ cardIds: [cardId.toLowerCase()] });

    expect(response.status).toBe(200);
    const [, init] = vi.mocked(global.fetch).mock.calls[0] as [URL, RequestInit];
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).has('X-Client-Secret')).toBe(false);
    expect(JSON.parse(String(init.body))).toEqual({ cardIds: [cardId] });
  });

  it('rejects proxy writes without a matching CSRF token', async () => {
    const app = await createApp();

    const response = await request(app)
      .patch('/api/learning-os/study/settings')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', authCookie())
      .send({ newCardsPerDay: 23 });

    expect(response.status).toBe(403);
    expect(response.body.error.message).toBe('Invalid CSRF token.');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects invalid or duplicate queue ids before calling Learning OS', async () => {
    const app = await createApp();
    const { cookies, token } = await csrfAuth(app);
    const cardId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

    const response = await request(app)
      .post('/api/learning-os/study/new-queue/reorder')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies)
      .set(CSRF_TOKEN_HEADER_NAME, token)
      .send({ cardIds: [cardId, cardId.toLowerCase()] });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe('cardIds must not contain duplicates.');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('keeps writes disabled when only the corresponding read flag is enabled', async () => {
    mockPrisma.featureFlag.findFirst.mockResolvedValue({
      ...enabledStudyApiFlags,
      studyApiSettings: true,
      studyApiSettingsWrite: false,
    });
    const app = await createApp();
    const { cookies, token } = await csrfAuth(app);

    const response = await request(app)
      .patch('/api/learning-os/study/settings')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies)
      .set(CSRF_TOKEN_HEADER_NAME, token)
      .send({ newCardsPerDay: 23 });

    expect(response.status).toBe(403);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('keeps writes disabled when their corresponding read route is off', async () => {
    mockPrisma.featureFlag.findFirst.mockResolvedValue({
      ...enabledStudyApiFlags,
      studyApiSettings: false,
      studyApiSettingsWrite: true,
    });
    const app = await createApp();
    const { cookies, token } = await csrfAuth(app);

    const response = await request(app)
      .patch('/api/learning-os/study/settings')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies)
      .set(CSRF_TOKEN_HEADER_NAME, token)
      .send({ newCardsPerDay: 23 });

    expect(response.status).toBe(403);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('gates and adapts the New Queue route with its supported query parameters', async () => {
    mockPrisma.featureFlag.findFirst.mockResolvedValue({
      ...enabledStudyApiFlags,
      studyApiSettings: false,
      studyApiOverview: false,
      studyApiBrowser: false,
      studyApiNewQueue: true,
      studyApiImports: false,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(newQueueResponse), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    );
    const app = await createApp();

    const response = await request(app)
      .get('/api/learning-os/study/new-queue?cursor=2&limit=25&q=%E4%BC%9A%E7%A4%BE')
      .set('Cookie', authCookie());

    expect(response.status).toBe(200);
    const [url] = vi.mocked(global.fetch).mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(
      'https://learning-os.example/api/study/new-queue?cursor=2&limit=25&q=%E4%BC%9A%E7%A4%BE'
    );
    expect(response.body).toEqual({
      items: [
        {
          id: 'card-1',
          noteId: 'note-1',
          cardType: 'recognition',
          displayText: '会社',
          meaning: 'company',
          queuePosition: 2,
          createdAt: '2026-07-15T12:00:00.000Z',
          updatedAt: '2026-07-15T13:00:00.000Z',
        },
      ],
      total: 1,
      limit: 25,
      nextCursor: null,
    });
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

  it('returns a configuration error when the proxy user email is missing', async () => {
    process.env.LEARNING_OS_PROXY_USER_EMAIL = '';
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

  it.each([
    '/api/learning-os/study/browser?q[foo]=bar',
    '/api/learning-os/study/browser?q=one&q=two',
  ])('rejects non-scalar query values before calling Learning OS', async (path) => {
    const app = await createApp();

    const response = await request(app).get(path).set('Cookie', authCookie());

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe(
      'Query parameter "q" must be provided exactly once as a string.'
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
