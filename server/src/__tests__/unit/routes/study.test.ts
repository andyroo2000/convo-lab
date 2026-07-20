import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import express, {
  json as expressJson,
  type ErrorRequestHandler,
  type NextFunction,
  type Request,
  type Response,
  type Router,
} from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CSRF_TOKEN_COOKIE_NAME,
  CSRF_TOKEN_HEADER_NAME,
  apiCsrfProtection,
  apiCsrfErrorHandler,
  issueCsrfTokenCookie,
  requireAllowedApiMutationOrigin,
} from '../../../middleware/csrf.js';
import { resetBrowserRuntimeTestState } from '../../helpers/browserRuntimeTestHelper.js';
import { getSetCookieArray, testCookieParser } from '../../helpers/testCookieParser.js';
import { mockPrisma } from '../../setup.js';

const { createRedisConnectionMock, execMock, expireAtMock, getStudyMediaAccessMock, multiMock } =
  vi.hoisted(() => ({
    createRedisConnectionMock: vi.fn(),
    execMock: vi.fn(),
    expireAtMock: vi.fn(),
    getStudyMediaAccessMock: vi.fn(),
    multiMock: vi.fn(),
  }));

vi.mock('../../../middleware/auth.js', () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    (req as Request & { userId: string }).userId = 'user-1';
    next();
  },
  AuthRequest: class {},
}));

vi.mock('../../../services/study/media.js', () => ({
  getStudyMediaAccess: getStudyMediaAccessMock,
}));

vi.mock('../../../config/redis.js', () => ({
  createRedisConnection: createRedisConnectionMock,
  defaultWorkerSettings: { concurrency: 1 },
}));

describe('Study Routes', () => {
  const originalEnv = process.env;
  let app: express.Application;
  let studyRouter: Router;
  let testClockOffset = 0;
  let temporaryDirectory: string;
  let csrfCookies: string[] = [];
  let csrfToken = '';

  function withMutationCsrf(
    requestBuilder: request.Test,
    origin: string = 'http://localhost:5173'
  ) {
    return requestBuilder
      .set('Origin', origin)
      .set('Cookie', csrfCookies)
      .set(CSRF_TOKEN_HEADER_NAME, csrfToken);
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = {
      ...originalEnv,
      CLIENT_URL: 'http://localhost:5173',
      NODE_ENV: 'test',
    };
    resetBrowserRuntimeTestState();
    expireAtMock.mockReset();
    execMock.mockReset();
    multiMock.mockReset();
    expireAtMock.mockResolvedValue(1);
    execMock.mockResolvedValue([
      [null, 1],
      [null, 1],
    ]);
    multiMock.mockImplementation(() => {
      const pipeline = {
        incr: vi.fn().mockReturnThis(),
        expireat: vi.fn().mockReturnThis(),
        exec: execMock,
      };
      return pipeline;
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    createRedisConnectionMock.mockReset();
    createRedisConnectionMock.mockReturnValue({
      multi: multiMock,
    });
    getStudyMediaAccessMock.mockResolvedValue(null);
    temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'study-route-test-'));
    vi.useFakeTimers();
    vi.setSystemTime(
      new Date(`2026-04-21T${String(12 + (testClockOffset % 12)).padStart(2, '0')}:00:00.000Z`)
    );
    testClockOffset += 1;
    app = express();
    app.use(testCookieParser);
    app.use(expressJson());
    app.use('/api/auth', requireAllowedApiMutationOrigin);
    app.use('/api/auth', apiCsrfProtection);
    app.use('/study', requireAllowedApiMutationOrigin);
    app.use('/study', apiCsrfProtection);
    app.get('/api/auth/csrf', (req, res) => {
      issueCsrfTokenCookie(req, res, 'lax');
      res.status(204).end();
    });
    mockPrisma.featureFlag.findFirst.mockResolvedValue({
      dialoguesEnabled: true,
      scriptsEnabled: true,
      audioCourseEnabled: true,
      flashcardsEnabled: true,
    });

    const module = await import('../../../routes/study.js');
    studyRouter = module.default;
    app.use('/study', studyRouter);
    app.use((_req, res) => {
      res.status(404).json({ message: 'Not found.' });
    });
    app.use(apiCsrfErrorHandler);
    app.use(((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const statusCode =
        typeof error === 'object' &&
        error !== null &&
        'statusCode' in error &&
        typeof error.statusCode === 'number'
          ? error.statusCode
          : 500;
      res.status(statusCode).json({ message });
    }) as ErrorRequestHandler);

    const csrfResponse = await request(app)
      .get('/api/auth/csrf')
      .set('Origin', 'http://localhost:5173');
    csrfCookies = getSetCookieArray(csrfResponse.headers['set-cookie']);
    const tokenCookie = csrfCookies
      .map((value) => value.split(';')[0])
      .find((value) => value.startsWith(`${CSRF_TOKEN_COOKIE_NAME}=`));
    csrfToken = tokenCookie
      ? decodeURIComponent(tokenCookie.slice(`${CSRF_TOKEN_COOKIE_NAME}=`.length))
      : '';
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = originalEnv;
    resetBrowserRuntimeTestState();
  });

  it('serves authenticated study media through the study media route', async () => {
    getStudyMediaAccessMock.mockResolvedValue({
      type: 'redirect',
      redirectUrl: 'https://example.com/study-audio.mp3',
      contentType: 'audio/mpeg',
      contentDisposition: 'inline',
      filename: 'audio.mp3',
    });

    const response = await request(app).get('/study/media/media-1');

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('https://example.com/study-audio.mp3');
    expect(getStudyMediaAccessMock).toHaveBeenCalledWith('user-1', 'media-1');
  });

  it('rate limits repeated study media reads', async () => {
    vi.useRealTimers();
    execMock.mockResolvedValueOnce([
      [null, 241],
      [null, 1],
    ]);

    const response = await request(app).get('/study/media/media-1');

    expect(response.status).toBe(429);
    expect(response.body.message).toContain('Too many study requests');
    expect(getStudyMediaAccessMock).not.toHaveBeenCalled();
  });

  it('blocks study routes when the flashcards feature flag is disabled', async () => {
    mockPrisma.featureFlag.findFirst.mockResolvedValue({
      dialoguesEnabled: true,
      scriptsEnabled: true,
      audioCourseEnabled: true,
      flashcardsEnabled: false,
    });

    const response = await request(app).get('/study/media/media-1');

    expect(response.status).toBe(403);
    expect(response.body.message).toContain('not enabled');
  });

  it('blocks study routes when the flashcards feature flag row is missing', async () => {
    mockPrisma.featureFlag.findFirst.mockResolvedValue(null);

    const response = await request(app).get('/study/media/media-1');

    expect(response.status).toBe(403);
    expect(response.body.message).toContain('not enabled');
  });

  it('allows read-only study routes without same-origin mutation headers', async () => {
    vi.useRealTimers();
    getStudyMediaAccessMock.mockResolvedValue(null);

    const response = await request(app).get('/study/media/media-1');

    expect(response.status).toBe(404);
    expect(getStudyMediaAccessMock).toHaveBeenCalled();
  });

  it.each([
    '/study/overview',
    '/study/settings',
    '/study/new-queue',
    '/study/browser',
    '/study/browser/note-1',
    '/study/export',
    '/study/export/cards',
    '/study/export/review-logs',
    '/study/export/media',
    '/study/export/imports',
    '/study/imports/readiness',
    '/study/imports/current',
    '/study/imports/import-1',
    '/study/card-drafts',
  ])('does not expose the retired read route %s', async (path) => {
    const response = await request(app).get(path);

    expect(response.status).toBe(404);
  });

  it.each([
    ['patch', '/study/settings'],
    ['post', '/study/new-queue/reorder'],
    ['post', '/study/session/start'],
    ['post', '/study/reviews'],
    ['post', '/study/reviews/undo'],
    ['post', '/study/cards'],
    ['patch', '/study/cards/card-1'],
    ['delete', '/study/cards/card-1'],
    ['post', '/study/cards/card-1/pitch-accent'],
    ['post', '/study/cards/card-1/actions'],
    ['post', '/study/cards/card-1/prepare-answer-audio'],
    ['post', '/study/cards/card-1/regenerate-answer-audio'],
    ['post', '/study/cards/card-1/regenerate-image'],
    ['post', '/study/card-candidates/generate'],
    ['post', '/study/card-candidates/regenerate-audio'],
    ['post', '/study/card-candidates/regenerate-image'],
    ['post', '/study/cards/draft/complete'],
    ['post', '/study/cards/draft/image'],
    ['post', '/study/card-candidates/commit'],
    ['post', '/study/card-candidates/vocab-bundle/drafts'],
    ['post', '/study/card-drafts'],
    ['patch', '/study/card-drafts/draft-1'],
    ['post', '/study/card-drafts/draft-1/retry'],
    ['post', '/study/card-drafts/draft-1/create-card'],
    ['delete', '/study/card-drafts/draft-1'],
    ['post', '/study/imports'],
    ['post', '/study/imports/import-1/complete'],
    ['post', '/study/imports/import-1/cancel'],
  ] as const)('does not expose the retired mutation route %s %s', async (method, path) => {
    const response = await withMutationCsrf(request(app)[method](path)).send({});

    expect(response.status).toBe(404);
  });

  it('sanitizes media filenames used in the Content-Disposition header', async () => {
    const audioPath = path.join(temporaryDirectory, 'study-audio.mp3');
    await writeFile(audioPath, Buffer.from('audio-data'));
    getStudyMediaAccessMock.mockResolvedValue({
      type: 'local',
      absolutePath: audioPath,
      contentType: 'audio/mpeg',
      contentDisposition: 'inline',
      filename: "evil\"; filename*=utf-8''oops.mp3",
    });

    const response = await request(app).get('/study/media/media-1');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('private, max-age=15552000, immutable');
    expect(response.headers['content-disposition']).toBe(
      'inline; filename="evil___filename__utf-8__oops.mp3"'
    );
  });

  it('forces attachment disposition for unsafe study media types', async () => {
    const svgPath = path.join(temporaryDirectory, 'study-image.svg');
    await writeFile(svgPath, Buffer.from('<svg />'));
    getStudyMediaAccessMock.mockResolvedValue({
      type: 'local',
      absolutePath: svgPath,
      contentType: 'image/svg+xml',
      contentDisposition: 'attachment',
      filename: 'diagram.svg',
    });

    const response = await request(app).get('/study/media/media-svg');

    expect(response.status).toBe(200);
    expect(response.headers['content-disposition']).toBe('attachment; filename="diagram.svg"');
  });
});
