import express, { json as expressJson } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CSRF_TOKEN_COOKIE_NAME,
  CSRF_TOKEN_HEADER_NAME,
  apiCsrfProtection,
  apiCsrfErrorHandler,
  requireAllowedApiMutationOrigin,
} from '../../../middleware/csrf.js';
import { errorHandler } from '../../../middleware/errorHandler.js';
import { resetBrowserRuntimeTestState } from '../../helpers/browserRuntimeTestHelper.js';
import { getSetCookieArray, testCookieParser } from '../../helpers/testCookieParser.js';

vi.mock('../../../config/passport.js', () => ({
  default: {
    authenticate: () => (_req: unknown, _res: unknown, next: () => void) => next(),
    initialize: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  },
}));

vi.mock('../../../db/client.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    inviteCode: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../../jobs/emailQueue.js', () => ({
  emailQueue: { add: vi.fn() },
}));

vi.mock('../../../services/oauth.js', () => ({
  revokeGoogleTokens: vi.fn(),
}));

vi.mock('../../../services/sampleContent.js', () => ({
  copySampleContentToUser: vi.fn(),
}));

vi.mock('../../../services/usageTracker.js', () => ({
  checkGenerationLimit: vi.fn(),
  checkCooldown: vi.fn(),
}));

describe('Auth route CSRF', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      CLIENT_URL: 'http://localhost:5173',
    };
    resetBrowserRuntimeTestState();
  });

  afterEach(() => {
    process.env = originalEnv;
    resetBrowserRuntimeTestState();
  });

  it('issues the shared CSRF cookie via GET /api/auth/csrf', async () => {
    const authRouter = (await import('../../../routes/auth.js')).default;
    const app = express();
    app.use(testCookieParser);
    app.use(expressJson());
    app.use('/api/auth', requireAllowedApiMutationOrigin);
    app.use('/api/auth', apiCsrfProtection);
    app.use('/api/auth', authRouter);
    app.use(apiCsrfErrorHandler);
    app.use(errorHandler);

    const response = await request(app)
      .get('/api/auth/csrf')
      .set('Origin', 'http://localhost:5173');

    expect(response.status).toBe(204);
    const cookies = getSetCookieArray(response.headers['set-cookie']);
    expect(cookies.some((value: string) => value.startsWith(`${CSRF_TOKEN_COOKIE_NAME}=`))).toBe(
      true
    );
  });

  it('rejects logout without a matching CSRF header', async () => {
    const authRouter = (await import('../../../routes/auth.js')).default;
    const app = express();
    app.use(testCookieParser);
    app.use(expressJson());
    app.use('/api/auth', requireAllowedApiMutationOrigin);
    app.use('/api/auth', apiCsrfProtection);
    app.use('/api/auth', authRouter);
    app.use(apiCsrfErrorHandler);
    app.use(errorHandler);

    const csrfResponse = await request(app)
      .get('/api/auth/csrf')
      .set('Origin', 'http://localhost:5173');

    const response = await request(app)
      .post('/api/auth/logout')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', getSetCookieArray(csrfResponse.headers['set-cookie']));

    expect(response.status).toBe(403);
    expect(response.body.error.message).toBe('Invalid CSRF token.');
  });

  it('allows logout with a matching CSRF header', async () => {
    const authRouter = (await import('../../../routes/auth.js')).default;
    const app = express();
    app.use(testCookieParser);
    app.use(expressJson());
    app.use('/api/auth', requireAllowedApiMutationOrigin);
    app.use('/api/auth', apiCsrfProtection);
    app.use('/api/auth', authRouter);
    app.use(apiCsrfErrorHandler);
    app.use(errorHandler);

    const csrfResponse = await request(app)
      .get('/api/auth/csrf')
      .set('Origin', 'http://localhost:5173');
    const setCookie = getSetCookieArray(csrfResponse.headers['set-cookie']);
    const tokenCookie = setCookie
      .map((value: string) => value.split(';')[0])
      .find((value: string) => value.startsWith(`${CSRF_TOKEN_COOKIE_NAME}=`));
    const csrfToken = tokenCookie
      ? decodeURIComponent(tokenCookie.slice(`${CSRF_TOKEN_COOKIE_NAME}=`.length))
      : '';

    const response = await request(app)
      .post('/api/auth/logout')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', setCookie)
      .set(CSRF_TOKEN_HEADER_NAME, csrfToken);

    expect(response.status).toBe(200);
  });
});
