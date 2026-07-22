import express, { json as expressJson, Response, NextFunction } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthRequest } from '../../../middleware/auth.js';
import {
  CSRF_TOKEN_COOKIE_NAME,
  CSRF_TOKEN_HEADER_NAME,
  apiCsrfProtection,
  apiCsrfErrorHandler,
  issueCsrfTokenCookie,
  requireAllowedApiMutationOrigin,
} from '../../../middleware/csrf.js';
import { AppError, errorHandler } from '../../../middleware/errorHandler.js';
import verificationRouter from '../../../routes/verification.js';
import { resetBrowserRuntimeTestState } from '../../helpers/browserRuntimeTestHelper.js';
import { getSetCookieArray, testCookieParser } from '../../helpers/testCookieParser.js';

// Create hoisted mocks
const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  emailVerificationToken: {
    deleteMany: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockEmailService = vi.hoisted(() => ({
  sendVerificationEmail: vi.fn(),
  sendWelcomeEmail: vi.fn(),
  verifyEmailToken: vi.fn(),
}));

const mockLearningOsAuth = vi.hoisted(() => ({
  resetLearningOsPassword: vi.fn(),
  sendLearningOsPasswordResetLink: vi.fn(),
  sendLearningOsVerificationEmail: vi.fn(),
  verifyLearningOsEmail: vi.fn(),
}));

vi.mock('../../../db/client.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../../services/emailService.js', () => mockEmailService);
vi.mock('../../../services/learningOsAuthProxy.js', () => mockLearningOsAuth);

// Mock auth middleware
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

  function withCsrf(requestBuilder: request.Test, origin: string = 'http://localhost:5173') {
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
      LEARNING_OS_VERIFICATION_PROXY_ENABLED: 'false',
    };
    resetBrowserRuntimeTestState();
    app = express();
    app.use(testCookieParser);
    app.use(expressJson());
    app.use('/api/auth', requireAllowedApiMutationOrigin);
    app.use('/api/auth', apiCsrfProtection);
    app.use('/api/verification', requireAllowedApiMutationOrigin);
    app.use('/api/verification', apiCsrfProtection);
    app.use('/api/password-reset', requireAllowedApiMutationOrigin);
    app.use('/api/password-reset', apiCsrfProtection);
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

    it('should send verification email for unverified user', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: false,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockEmailService.sendVerificationEmail.mockResolvedValue(undefined);

      const response = await withCsrf(request(app).post('/api/verification/send')).expect(200);

      expect(response.body).toEqual({ message: 'Verification email sent' });
      expect(response.headers['ratelimit-policy']).toBeDefined();
      expect(mockEmailService.sendVerificationEmail).toHaveBeenCalledWith(
        mockUser.id,
        mockUser.email,
        mockUser.name
      );
    });

    it('should reject if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const response = await withCsrf(request(app).post('/api/verification/send')).expect(404);

      expect(response.body.error.message).toBe('User not found');
      expect(mockEmailService.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('should reject if email already verified', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: true,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const response = await withCsrf(request(app).post('/api/verification/send')).expect(400);

      expect(response.body.error.message).toBe('Email already verified');
      expect(mockEmailService.sendVerificationEmail).not.toHaveBeenCalled();
    });
  });

  describe('Learning OS verification routing', () => {
    beforeEach(() => {
      process.env.LEARNING_OS_VERIFICATION_PROXY_ENABLED = 'true';
      mockLearningOsAuth.sendLearningOsVerificationEmail.mockResolvedValue(undefined);
      mockLearningOsAuth.verifyLearningOsEmail.mockResolvedValue({
        message: 'Email verified successfully',
        email: 'test@example.com',
      });
    });

    it('resends through signed session identity without touching legacy persistence', async () => {
      const response = await withCsrf(request(app).post('/api/verification/send')).expect(200);

      expect(response.body).toEqual({ message: 'Verification email sent' });
      expect(mockLearningOsAuth.sendLearningOsVerificationEmail).toHaveBeenCalledWith(
        'test-user-id',
        {
          userId: 'test-user-id',
          email: 'test@example.com',
          role: 'user',
          accountSource: 'learning-os',
        }
      );
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
      expect(mockEmailService.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('translates the public path token through Learning OS', async () => {
      const response = await request(app)
        .get(`/api/verification/${'a'.repeat(64)}`)
        .expect(200);

      expect(response.body).toEqual({
        message: 'Email verified successfully',
        email: 'test@example.com',
      });
      expect(response.headers['ratelimit-policy']).toBeDefined();
      expect(mockLearningOsAuth.verifyLearningOsEmail).toHaveBeenCalledWith('a'.repeat(64));
      expect(mockEmailService.verifyEmailToken).not.toHaveBeenCalled();
      expect(mockEmailService.sendWelcomeEmail).not.toHaveBeenCalled();
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

  describe('GET /api/verification/:token', () => {
    it('should verify email with valid token', async () => {
      const mockTokenResult = {
        userId: 'test-user-id',
        email: 'test@example.com',
      };

      const mockUser = {
        name: 'Test User',
        email: 'test@example.com',
      };

      mockEmailService.verifyEmailToken.mockResolvedValue(mockTokenResult);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockEmailService.sendWelcomeEmail.mockResolvedValue(undefined);

      const response = await request(app).get('/api/verification/valid-token').expect(200);

      expect(response.body).toEqual({
        message: 'Email verified successfully',
        email: 'test@example.com',
      });
      expect(mockEmailService.verifyEmailToken).toHaveBeenCalledWith('valid-token');
      expect(mockEmailService.sendWelcomeEmail).toHaveBeenCalledWith(mockUser.email, mockUser.name);
    });

    it('should reject invalid token', async () => {
      mockEmailService.verifyEmailToken.mockResolvedValue(null);

      const response = await request(app).get('/api/verification/invalid-token').expect(400);

      expect(response.body.error.message).toBe('Invalid or expired verification token');
      expect(mockEmailService.sendWelcomeEmail).not.toHaveBeenCalled();
    });

    it('should handle expired token', async () => {
      mockEmailService.verifyEmailToken.mockResolvedValue(null);

      const response = await request(app).get('/api/verification/expired-token').expect(400);

      expect(response.body.error.message).toBe('Invalid or expired verification token');
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
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should reject request without email', async () => {
      const response = await withCsrf(request(app).post('/api/password-reset/request'))
        .send({})
        .expect(400);

      expect(response.body.error.message).toBe('Email is required');
    });

    it('rate limits repeated reset-link requests for the same normalized email', async () => {
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
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
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

    it('should reject password reset without token', async () => {
      const response = await withCsrf(request(app).post('/api/password-reset/verify'))
        .send({ newPassword: 'newpassword123' })
        .expect(400);

      expect(response.body.error.message).toBe('Token and new password are required');
    });

    it('should reject password reset without new password', async () => {
      const response = await withCsrf(request(app).post('/api/password-reset/verify'))
        .send({ token: 'valid-token' })
        .expect(400);

      expect(response.body.error.message).toBe('Token and new password are required');
    });

    it('should reject password shorter than 8 characters', async () => {
      const response = await withCsrf(request(app).post('/api/password-reset/verify'))
        .send({
          token: 'valid-token',
          newPassword: 'short',
        })
        .expect(400);

      expect(response.body.error.message).toBe('Password must be at least 8 characters');
    });
  });
});
