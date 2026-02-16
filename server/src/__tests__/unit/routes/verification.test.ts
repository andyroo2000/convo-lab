import express, { json as expressJson, Response, NextFunction } from 'express';
import request from 'supertest';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AuthRequest } from '../../../middleware/auth.js';
import { errorHandler } from '../../../middleware/errorHandler.js';
import verificationRouter from '../../../routes/verification.js';

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
  passwordResetToken: {
    deleteMany: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
}));

const mockEmailService = vi.hoisted(() => ({
  sendVerificationEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  sendWelcomeEmail: vi.fn(),
  sendPasswordChangedEmail: vi.fn(),
  verifyEmailToken: vi.fn(),
  verifyPasswordResetToken: vi.fn(),
  markPasswordResetTokenUsed: vi.fn(),
}));

vi.mock('../../../db/client.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../../services/emailService.js', () => mockEmailService);

// Mock auth middleware
vi.mock('../../../middleware/auth.js', () => ({
  requireAuth: (req: AuthRequest, _res: Response, next: NextFunction) => {
    req.userId = 'test-user-id';
    next();
  },
  AuthRequest: class {},
}));

describe('Verification Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(expressJson());
    app.use('/api', verificationRouter);
    app.use(errorHandler);
  });

  describe('POST /api/verification/send', () => {
    it('should send verification email for unverified user', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: false,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockEmailService.sendVerificationEmail.mockResolvedValue(undefined);

      const response = await request(app).post('/api/verification/send').expect(200);

      expect(response.body).toEqual({ message: 'Verification email sent' });
      expect(mockEmailService.sendVerificationEmail).toHaveBeenCalledWith(
        mockUser.id,
        mockUser.email,
        mockUser.name
      );
    });

    it('should reject if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app).post('/api/verification/send').expect(404);

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

      const response = await request(app).post('/api/verification/send').expect(400);

      expect(response.body.error.message).toBe('Email already verified');
      expect(mockEmailService.sendVerificationEmail).not.toHaveBeenCalled();
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
    it('should send password reset email for existing user', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockEmailService.sendPasswordResetEmail.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/password-reset/request')
        .send({ email: 'test@example.com' })
        .expect(200);

      expect(response.body.message).toBe(
        'If an account exists with that email, a password reset link has been sent'
      );
      expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        mockUser.id,
        mockUser.email,
        mockUser.name
      );
    });

    it('should return success message even for non-existent user (prevent enumeration)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/password-reset/request')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      expect(response.body.message).toBe(
        'If an account exists with that email, a password reset link has been sent'
      );
      expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should reject request without email', async () => {
      const response = await request(app).post('/api/password-reset/request').send({}).expect(400);

      expect(response.body.error.message).toBe('Email is required');
    });
  });

  describe('GET /api/password-reset/:token', () => {
    it('should validate password reset token', async () => {
      const mockTokenResult = {
        userId: 'test-user-id',
        email: 'test@example.com',
      };

      mockEmailService.verifyPasswordResetToken.mockResolvedValue(mockTokenResult);

      const response = await request(app).get('/api/password-reset/valid-token').expect(200);

      expect(response.body).toEqual({
        valid: true,
        email: 'test@example.com',
      });
    });

    it('should reject invalid password reset token', async () => {
      mockEmailService.verifyPasswordResetToken.mockResolvedValue(null);

      const response = await request(app).get('/api/password-reset/invalid-token').expect(400);

      expect(response.body.error.message).toBe('Invalid or expired password reset token');
    });
  });

  describe('POST /api/password-reset/verify', () => {
    it('should reset password with valid token', async () => {
      const mockTokenResult = {
        userId: 'test-user-id',
        email: 'test@example.com',
      };

      const mockUser = {
        name: 'Test User',
        email: 'test@example.com',
      };

      mockEmailService.verifyPasswordResetToken.mockResolvedValue(mockTokenResult);
      mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockPrisma));
      mockPrisma.user.update.mockResolvedValue(mockUser);
      mockEmailService.markPasswordResetTokenUsed.mockResolvedValue(undefined);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockEmailService.sendPasswordChangedEmail.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/password-reset/verify')
        .send({
          token: 'valid-token',
          newPassword: 'newpassword123',
        })
        .expect(200);

      expect(response.body.message).toBe('Password reset successfully');
      expect(mockEmailService.verifyPasswordResetToken).toHaveBeenCalledWith('valid-token');
      expect(mockPrisma.user.update).toHaveBeenCalled();
      expect(mockEmailService.sendPasswordChangedEmail).toHaveBeenCalledWith(
        mockUser.email,
        mockUser.name
      );
    });

    it('should reject password reset without token', async () => {
      const response = await request(app)
        .post('/api/password-reset/verify')
        .send({ newPassword: 'newpassword123' })
        .expect(400);

      expect(response.body.error.message).toBe('Token and new password are required');
    });

    it('should reject password reset without new password', async () => {
      const response = await request(app)
        .post('/api/password-reset/verify')
        .send({ token: 'valid-token' })
        .expect(400);

      expect(response.body.error.message).toBe('Token and new password are required');
    });

    it('should reject password shorter than 8 characters', async () => {
      const response = await request(app)
        .post('/api/password-reset/verify')
        .send({
          token: 'valid-token',
          newPassword: 'short',
        })
        .expect(400);

      expect(response.body.error.message).toBe('Password must be at least 8 characters');
    });

    it('should reject invalid password reset token', async () => {
      mockEmailService.verifyPasswordResetToken.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/password-reset/verify')
        .send({
          token: 'invalid-token',
          newPassword: 'newpassword123',
        })
        .expect(400);

      expect(response.body.error.message).toBe('Invalid or expired password reset token');
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should hash password before saving', async () => {
      const mockTokenResult = {
        userId: 'test-user-id',
        email: 'test@example.com',
      };

      const mockUser = {
        name: 'Test User',
        email: 'test@example.com',
      };

      mockEmailService.verifyPasswordResetToken.mockResolvedValue(mockTokenResult);
      mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockPrisma));
      mockPrisma.user.update.mockResolvedValue(mockUser);
      mockEmailService.markPasswordResetTokenUsed.mockResolvedValue(undefined);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockEmailService.sendPasswordChangedEmail.mockResolvedValue(undefined);

      await request(app)
        .post('/api/password-reset/verify')
        .send({
          token: 'valid-token',
          newPassword: 'newpassword123',
        })
        .expect(200);

      // Verify that user.update was called with a hashed password
      expect(mockPrisma.user.update).toHaveBeenCalled();
      const updateCall = mockPrisma.user.update.mock.calls[0][0];
      expect(updateCall.data.password).toBeTruthy();
      expect(updateCall.data.password).not.toBe('newpassword123'); // Should be hashed
      expect(updateCall.data.password.length).toBeGreaterThan(20); // Bcrypt hashes are longer
    });
  });
});
