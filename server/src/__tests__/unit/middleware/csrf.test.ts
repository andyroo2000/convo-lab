import express, { json as expressJson } from 'express';
import request from 'supertest';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import {
  CSRF_TOKEN_COOKIE_NAME,
  CSRF_TOKEN_HEADER_NAME,
  apiCsrfProtection,
  apiCsrfErrorHandler,
  getAllowedApiOrigins,
  issueCsrfTokenCookie,
  requireAllowedApiMutationOrigin,
  resetAllowedApiOriginsCacheForTests,
} from '../../../middleware/csrf.js';
import { errorHandler } from '../../../middleware/errorHandler.js';
import { getSetCookieArray, testCookieParser } from '../../helpers/testCookieParser.js';

describe('csrf middleware', () => {
  beforeEach(() => {
    process.env.CLIENT_URL = 'https://app.example.com';
    process.env.NODE_ENV = 'production';
    resetAllowedApiOriginsCacheForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetAllowedApiOriginsCacheForTests();
  });

  it('allows safe methods without token validation', async () => {
    const app = await createCsrfApp();
    app.get('/api/overview', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const response = await request(app).get('/api/overview');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  async function createCsrfApp() {
    const app = express();
    app.use(testCookieParser);
    app.use(expressJson());
    app.use('/api', requireAllowedApiMutationOrigin);
    app.use('/api', apiCsrfProtection);
    app.get('/api/auth/csrf', (req, res) => {
      issueCsrfTokenCookie(req, res, 'lax');
      res.sendStatus(204);
    });
    app.post('/api/protected', (_req, res) => {
      res.sendStatus(204);
    });
    app.use(apiCsrfErrorHandler);
    app.use(errorHandler);
    return app;
  }

  async function bootstrapCsrf(origin: string = 'https://app.example.com') {
    const app = await createCsrfApp();
    const csrfResponse = await request(app).get('/api/auth/csrf').set('Origin', origin);
    const setCookie = getSetCookieArray(csrfResponse.headers['set-cookie']);
    const tokenCookie = setCookie
      .map((value) => value.split(';')[0])
      .find((value) => value.startsWith(`${CSRF_TOKEN_COOKIE_NAME}=`));
    const token = tokenCookie
      ? decodeURIComponent(tokenCookie.slice(`${CSRF_TOKEN_COOKIE_NAME}=`.length))
      : '';
    return { app, setCookie, token };
  }

  it('allows valid origin with matching token', async () => {
    const { app, setCookie, token } = await bootstrapCsrf();

    const response = await request(app)
      .post('/api/protected')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', setCookie)
      .set(CSRF_TOKEN_HEADER_NAME, token);

    expect(response.status).toBe(204);
  });

  it('rejects missing header token', async () => {
    const { app, setCookie } = await bootstrapCsrf();
    const response = await request(app)
      .post('/api/protected')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', setCookie);

    expect(response.status).toBe(403);
    expect(response.body.error.message).toBe('Invalid CSRF token.');
  });

  it('rejects invalid origin', async () => {
    const { app, setCookie, token } = await bootstrapCsrf();
    const response = await request(app)
      .post('/api/protected')
      .set('Origin', 'https://evil.example.com')
      .set('Cookie', setCookie)
      .set(CSRF_TOKEN_HEADER_NAME, token);

    expect(response.status).toBe(403);
    expect(response.body.error.message).toBe('Invalid request origin.');
  });

  it('rebuilds allowed origins cache when CLIENT_URL changes', () => {
    expect(getAllowedApiOrigins().has('https://app.example.com')).toBe(true);
    process.env.CLIENT_URL = 'https://new.example.com';
    resetAllowedApiOriginsCacheForTests();
    expect(getAllowedApiOrigins().has('https://new.example.com')).toBe(true);
  });
});
