import express, { json as expressJson, NextFunction, Response } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthRequest } from '../../../middleware/auth.js';
import {
  apiCsrfErrorHandler,
  apiCsrfProtection,
  CSRF_TOKEN_COOKIE_NAME,
  CSRF_TOKEN_HEADER_NAME,
  issueCsrfTokenCookie,
  requireAllowedApiMutationOrigin,
} from '../../../middleware/csrf.js';
import { AppError, errorHandler } from '../../../middleware/errorHandler.js';
import verificationRouter from '../../../routes/verification.js';
import { resetBrowserRuntimeTestState } from '../../helpers/browserRuntimeTestHelper.js';
import { getSetCookieArray, testCookieParser } from '../../helpers/testCookieParser.js';

const mockLearningOsAuth = vi.hoisted(() => ({
  resetLearningOsPassword: vi.fn(),
  sendLearningOsPasswordResetLink: vi.fn(),
  sendLearningOsVerificationEmail: vi.fn(),
  verifyLearningOsEmail: vi.fn(),
}));

vi.mock('../../../services/learningOsAuthProxy.js', () => mockLearningOsAuth);
vi.mock('../../../middleware/auth.js', () => ({
  requireAuth: (req: AuthRequest, _res: Response, next: NextFunction) => {
    req.userId = 'test-user-id';
    req.email = 'test@example.com';
    req.role = 'user';
    req.accountSource = 'learning-os';
    next();
  },
  AuthRequest: class {},
}));

describe('Verification Routes', () => {
  let app: express.Application;
  const originalEnv = process.env;
  let csrfCookies: string[] = [];
  let csrfToken = '';

  function withCsrf(requestBuilder: request.Test, origin = 'http://localhost:5173') {
    return requestBuilder
      .set('Origin', origin)
      .set('Cookie', csrfCookies)
      .set(CSRF_TOKEN_HEADER_NAME, csrfToken);
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      CLIENT_URL: 'http://localhost:5173',
    };
    resetBrowserRuntimeTestState();
    app = express();
    app.use(testCookieParser);
    app.use(expressJson());
    app.use('/api/auth', requireAllowedApiMutationOrigin, apiCsrfProtection);
    app.use('/api/verification', requireAllowedApiMutationOrigin, apiCsrfProtection);
    app.use('/api/password-reset', requireAllowedApiMutationOrigin, apiCsrfProtection);
    app.get('/api/auth/csrf', (req, res) => {
      issueCsrfTokenCookie(req, res, 'lax');
      res.status(204).end();
    });
    app.use('/api', verificationRouter);
    app.use(apiCsrfErrorHandler);
    app.use(errorHandler);

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
    process.env = originalEnv;
    resetBrowserRuntimeTestState();
  });

  describe('POST /api/verification/send', () => {
    it('rejects resend verification without a CSRF token', async () => {
      const response = await request(app)
        .post('/api/verification/send')
        .set('Origin', 'http://localhost:5173')
        .expect(403);

      expect(response.body.error.message).toBe('Invalid CSRF token.');
    });

    it('always resends through signed Learning OS session identity', async () => {
      mockLearningOsAuth.sendLearningOsVerificationEmail.mockResolvedValue(undefined);

      const response = await withCsrf(request(app).post('/api/verification/send')).expect(200);

      expect(response.body).toEqual({ message: 'Verification email sent' });
      expect(response.headers['ratelimit-policy']).toBeDefined();
      expect(mockLearningOsAuth.sendLearningOsVerificationEmail).toHaveBeenCalledWith(
        'test-user-id',
        {
          userId: 'test-user-id',
          email: 'test@example.com',
          role: 'user',
          accountSource: 'learning-os',
        }
      );
    });
  });

  describe('GET /api/verification/:token', () => {
    it('always translates the public path token through Learning OS', async () => {
      mockLearningOsAuth.verifyLearningOsEmail.mockResolvedValue({
        message: 'Email verified successfully',
        email: 'test@example.com',
      });

      const response = await request(app)
        .get(`/api/verification/${'a'.repeat(64)}`)
        .expect(200);

      expect(response.body).toEqual({
        message: 'Email verified successfully',
        email: 'test@example.com',
      });
      expect(response.headers['ratelimit-policy']).toBeDefined();
      expect(mockLearningOsAuth.verifyLearningOsEmail).toHaveBeenCalledWith('a'.repeat(64));
    });

    it('passes controlled Learning OS failures through the standard error envelope', async () => {
      mockLearningOsAuth.verifyLearningOsEmail.mockRejectedValue(
        new AppError('Invalid or expired verification token', 400)
      );

      const response = await request(app).get('/api/verification/invalid-token').expect(400);

      expect(response.body).toEqual({
        error: { message: 'Invalid or expired verification token', statusCode: 400 },
      });
    });
  });

  describe('POST /api/password-reset/request', () => {
    it('routes reset-link issuance through Learning OS', async () => {
      mockLearningOsAuth.sendLearningOsPasswordResetLink.mockResolvedValue(undefined);

      const response = await withCsrf(request(app).post('/api/password-reset/request'))
        .send({ email: 'target-only@example.com' })
        .expect(200);

      expect(response.body.message).toBe(
        'If an account exists with that email, a password reset link has been sent'
      );
      expect(response.headers['ratelimit-policy']).toBeDefined();
      expect(mockLearningOsAuth.sendLearningOsPasswordResetLink).toHaveBeenCalledWith(
        'target-only@example.com'
      );
    });

    it('rejects a request without email', async () => {
      const response = await withCsrf(request(app).post('/api/password-reset/request'))
        .send({})
        .expect(400);

      expect(response.body.error.message).toBe('Email is required');
    });

    it('rate limits repeated requests for the same normalized email', async () => {
      mockLearningOsAuth.sendLearningOsPasswordResetLink.mockResolvedValue(undefined);

      for (let attempt = 0; attempt < 10; attempt += 1) {
        const email = attempt % 2 === 0 ? 'rate-limit@example.com' : ' RATE-LIMIT@example.com ';
        await withCsrf(request(app).post('/api/password-reset/request'))
          .send({ email })
          .expect(200);
      }

      const response = await withCsrf(request(app).post('/api/password-reset/request'))
        .send({ email: 'rate-limit@example.com' })
        .expect(429);

      expect(response.headers['retry-after']).toBeDefined();
      expect(mockLearningOsAuth.sendLearningOsPasswordResetLink).toHaveBeenCalledTimes(10);
    });
  });

  describe('POST /api/password-reset/verify', () => {
    it('routes reset completion through Learning OS', async () => {
      mockLearningOsAuth.resetLearningOsPassword.mockResolvedValue(undefined);

      const response = await withCsrf(request(app).post('/api/password-reset/verify'))
        .send({
          email: 'target-only@example.com',
          token: 'learning-os-token',
          newPassword: 'newpassword123',
        })
        .expect(200);

      expect(response.body.message).toBe('Password reset successfully');
      expect(response.headers['ratelimit-policy']).toBeDefined();
      expect(mockLearningOsAuth.resetLearningOsPassword).toHaveBeenCalledWith({
        email: 'target-only@example.com',
        token: 'learning-os-token',
        newPassword: 'newpassword123',
      });
    });

    it('passes Learning OS validation failures through the standard error envelope', async () => {
      mockLearningOsAuth.resetLearningOsPassword.mockRejectedValue(
        new AppError('Invalid or expired password reset token', 400)
      );

      const response = await withCsrf(request(app).post('/api/password-reset/verify'))
        .send({
          email: 'target-only@example.com',
          token: 'invalid-token',
          newPassword: 'newpassword123',
        })
        .expect(400);

      expect(response.body.error.message).toBe('Invalid or expired password reset token');
    });

    it.each([
      [{ newPassword: 'newpassword123' }, 'Token and new password are required'],
      [{ token: 'valid-token' }, 'Token and new password are required'],
      [{ token: 'valid-token', newPassword: 'short' }, 'Password must be at least 8 characters'],
    ])('rejects malformed reset bodies', async (body, message) => {
      const response = await withCsrf(request(app).post('/api/password-reset/verify'))
        .send(body)
        .expect(400);

      expect(response.body.error.message).toBe(message);
    });
  });
});
