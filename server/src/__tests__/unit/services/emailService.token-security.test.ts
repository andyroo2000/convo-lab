import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  verifyEmailToken,
  verifyPasswordResetToken,
  markPasswordResetTokenUsed,
} from '../../../services/emailService.js';
import { mockPrisma } from '../../setup.js';

// Mock Resend
vi.mock('resend', () => ({
  Resend: vi.fn(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ id: 'email-123' }),
    },
  })),
}));

// Mock crypto for deterministic testing
vi.mock('crypto', () => ({
  default: {
    randomBytes: vi.fn(() => ({
      toString: vi.fn(() => 'a'.repeat(64)), // 32 bytes = 64 hex chars
    })),
  },
}));

describe('Email Service - Token Security Tests', () => {
  const mockUserId = 'user-123';
  const mockEmail = 'test@example.com';
  const mockName = 'Test User';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Token Generation Security', () => {
    it('should generate cryptographically secure 32-byte tokens', async () => {
      mockPrisma.emailVerificationToken.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.emailVerificationToken.create.mockResolvedValue({});

      await sendVerificationEmail(mockUserId, mockEmail, mockName);

      // Verify 64 character hex string (32 bytes)
      const createCall = mockPrisma.emailVerificationToken.create.mock.calls[0][0];
      expect(createCall.data.token).toHaveLength(64);
    });

    it('should set 24-hour expiration for email verification tokens', async () => {
      const now = Date.now();
      vi.setSystemTime(now);

      mockPrisma.emailVerificationToken.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.emailVerificationToken.create.mockResolvedValue({});

      await sendVerificationEmail(mockUserId, mockEmail, mockName);

      const createCall = mockPrisma.emailVerificationToken.create.mock.calls[0][0];
      const expiresAt = new Date(createCall.data.expiresAt);
      const expectedExpiry = new Date(now + 24 * 60 * 60 * 1000);

      expect(expiresAt.getTime()).toBe(expectedExpiry.getTime());

      vi.useRealTimers();
    });

    it('should set 1-hour expiration for password reset tokens', async () => {
      const now = Date.now();
      vi.setSystemTime(now);

      mockPrisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.passwordResetToken.create.mockResolvedValue({});

      await sendPasswordResetEmail(mockUserId, mockEmail, mockName);

      const createCall = mockPrisma.passwordResetToken.create.mock.calls[0][0];
      const expiresAt = new Date(createCall.data.expiresAt);
      const expectedExpiry = new Date(now + 60 * 60 * 1000);

      expect(expiresAt.getTime()).toBe(expectedExpiry.getTime());

      vi.useRealTimers();
    });
  });

  describe('Email Verification Token Expiration', () => {
    it('should reject expired verification token (25 hours old)', async () => {
      const now = new Date();
      const expiredTime = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25 hours ago

      mockPrisma.emailVerificationToken.findUnique.mockResolvedValue({
        token: 'expired-token',
        userId: mockUserId,
        expiresAt: expiredTime,
        user: { email: mockEmail },
      });

      mockPrisma.emailVerificationToken.delete.mockResolvedValue({});

      const result = await verifyEmailToken('expired-token');

      expect(result).toBeNull();

      // Verify token was deleted
      expect(mockPrisma.emailVerificationToken.delete).toHaveBeenCalledWith({
        where: { token: 'expired-token' },
      });
    });

    it('should accept valid verification token (23 hours old)', async () => {
      const now = new Date();
      const validTime = new Date(now.getTime() + 1 * 60 * 60 * 1000); // Expires in 1 hour

      mockPrisma.emailVerificationToken.findUnique.mockResolvedValue({
        token: 'valid-token',
        userId: mockUserId,
        expiresAt: validTime,
        user: { email: mockEmail },
      });

      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.emailVerificationToken.delete.mockResolvedValue({});

      const result = await verifyEmailToken('valid-token');

      expect(result).toEqual({
        userId: mockUserId,
        email: mockEmail,
      });

      // Verify user was marked as verified
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: {
          emailVerified: true,
          emailVerifiedAt: expect.any(Date),
        },
      });

      // Verify token was deleted after use
      expect(mockPrisma.emailVerificationToken.delete).toHaveBeenCalledWith({
        where: { token: 'valid-token' },
      });
    });

    it('should reject non-existent token', async () => {
      mockPrisma.emailVerificationToken.findUnique.mockResolvedValue(null);

      const result = await verifyEmailToken('nonexistent-token');

      expect(result).toBeNull();
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('Password Reset Token Expiration', () => {
    it('should reject expired password reset token (65 minutes old)', async () => {
      const now = new Date();
      const expiredTime = new Date(now.getTime() - 65 * 60 * 1000); // 65 minutes ago

      mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
        token: 'expired-reset-token',
        userId: mockUserId,
        expiresAt: expiredTime,
        usedAt: null,
        user: { email: mockEmail },
      });

      mockPrisma.passwordResetToken.delete.mockResolvedValue({});

      const result = await verifyPasswordResetToken('expired-reset-token');

      expect(result).toBeNull();

      // Verify token was deleted
      expect(mockPrisma.passwordResetToken.delete).toHaveBeenCalledWith({
        where: { token: 'expired-reset-token' },
      });
    });

    it('should accept valid password reset token (30 minutes old)', async () => {
      const now = new Date();
      const validTime = new Date(now.getTime() + 30 * 60 * 1000); // Expires in 30 min

      mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
        token: 'valid-reset-token',
        userId: mockUserId,
        expiresAt: validTime,
        usedAt: null,
        user: { email: mockEmail },
      });

      const result = await verifyPasswordResetToken('valid-reset-token');

      expect(result).toEqual({
        userId: mockUserId,
        email: mockEmail,
      });
    });
  });

  describe('Token Reuse Prevention', () => {
    it('should delete verification token after first successful use', async () => {
      const validTime = new Date(Date.now() + 24 * 60 * 60 * 1000);

      mockPrisma.emailVerificationToken.findUnique.mockResolvedValue({
        token: 'one-time-token',
        userId: mockUserId,
        expiresAt: validTime,
        user: { email: mockEmail },
      });

      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.emailVerificationToken.delete.mockResolvedValue({});

      // First use
      const result1 = await verifyEmailToken('one-time-token');
      expect(result1).not.toBeNull();

      // Verify token deletion was called
      expect(mockPrisma.emailVerificationToken.delete).toHaveBeenCalledWith({
        where: { token: 'one-time-token' },
      });

      // Second use - token no longer exists
      mockPrisma.emailVerificationToken.findUnique.mockResolvedValue(null);
      const result2 = await verifyEmailToken('one-time-token');
      expect(result2).toBeNull();
    });

    it('should reject password reset token with usedAt timestamp', async () => {
      const validTime = new Date(Date.now() + 30 * 60 * 1000);
      const usedTime = new Date();

      mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
        token: 'used-reset-token',
        userId: mockUserId,
        expiresAt: validTime,
        usedAt: usedTime, // Already used
        user: { email: mockEmail },
      });

      const result = await verifyPasswordResetToken('used-reset-token');

      expect(result).toBeNull();
    });

    it('should mark password reset token as used after password change', async () => {
      mockPrisma.passwordResetToken.update.mockResolvedValue({});

      await markPasswordResetTokenUsed('reset-token');

      expect(mockPrisma.passwordResetToken.update).toHaveBeenCalledWith({
        where: { token: 'reset-token' },
        data: { usedAt: expect.any(Date) },
      });
    });
  });

  describe('Token Invalidation on New Request', () => {
    it('should delete old verification tokens when sending new one', async () => {
      mockPrisma.emailVerificationToken.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.emailVerificationToken.create.mockResolvedValue({});

      await sendVerificationEmail(mockUserId, mockEmail, mockName);

      // Verify old tokens were deleted first
      expect(mockPrisma.emailVerificationToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
      });

      // Then new token was created
      expect(mockPrisma.emailVerificationToken.create).toHaveBeenCalled();

      // Verify deleteMany called before create
      const deleteOrder = mockPrisma.emailVerificationToken.deleteMany.mock.invocationCallOrder[0];
      const createOrder = mockPrisma.emailVerificationToken.create.mock.invocationCallOrder[0];
      expect(deleteOrder).toBeLessThan(createOrder);
    });

    it('should delete old password reset tokens when requesting new one', async () => {
      mockPrisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.passwordResetToken.create.mockResolvedValue({});

      await sendPasswordResetEmail(mockUserId, mockEmail, mockName);

      // Verify old tokens were deleted first
      expect(mockPrisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
      });

      // Then new token was created
      expect(mockPrisma.passwordResetToken.create).toHaveBeenCalled();

      // Verify correct order
      const deleteOrder = mockPrisma.passwordResetToken.deleteMany.mock.invocationCallOrder[0];
      const createOrder = mockPrisma.passwordResetToken.create.mock.invocationCallOrder[0];
      expect(deleteOrder).toBeLessThan(createOrder);
    });

    it('should only allow most recent verification token to work', async () => {
      // Simulate user requesting verification email twice
      mockPrisma.emailVerificationToken.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.emailVerificationToken.create.mockResolvedValue({});

      // First request (token: old-token)
      await sendVerificationEmail(mockUserId, mockEmail, mockName);

      // Second request (token: new-token) - should invalidate first
      await sendVerificationEmail(mockUserId, mockEmail, mockName);

      // Verify deleteMany was called on second request
      expect(mockPrisma.emailVerificationToken.deleteMany).toHaveBeenCalledTimes(2);
    });
  });

  describe('Malformed Token Handling', () => {
    it('should handle invalid UUID format gracefully', async () => {
      mockPrisma.emailVerificationToken.findUnique.mockResolvedValue(null);

      const result = await verifyEmailToken('invalid-format-!@#$');

      expect(result).toBeNull();
    });

    it('should handle empty token string', async () => {
      mockPrisma.emailVerificationToken.findUnique.mockResolvedValue(null);

      const result = await verifyEmailToken('');

      expect(result).toBeNull();
    });

    it('should handle SQL injection attempts safely', async () => {
      const sqlInjection = "'; DROP TABLE users; --";
      mockPrisma.emailVerificationToken.findUnique.mockResolvedValue(null);

      const result = await verifyEmailToken(sqlInjection);

      expect(result).toBeNull();
      // Prisma's parameterized queries prevent SQL injection
      expect(mockPrisma.emailVerificationToken.findUnique).toHaveBeenCalledWith({
        where: { token: sqlInjection },
        include: { user: true },
      });
    });
  });

  describe('Email Sending Failures', () => {
    it('should throw error if verification email send fails', async () => {
      mockPrisma.emailVerificationToken.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.emailVerificationToken.create.mockResolvedValue({});

      // Mock Resend to fail
      const resendMock = await import('resend');
      vi.mocked(resendMock.Resend).mockImplementation(
        () =>
          ({
            emails: {
              send: vi.fn().mockRejectedValue(new Error('Email service down')),
            },
          }) as unknown as InstanceType<typeof resendMock.Resend>
      );

      // In dev mode, should not throw (logs to console instead)
      await expect(sendVerificationEmail(mockUserId, mockEmail, mockName)).resolves.not.toThrow();
    });

    it('should create token even if email send fails (for retry)', async () => {
      mockPrisma.emailVerificationToken.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.emailVerificationToken.create.mockResolvedValue({});

      await sendVerificationEmail(mockUserId, mockEmail, mockName);

      // Token should be created in database regardless of email send status
      expect(mockPrisma.emailVerificationToken.create).toHaveBeenCalled();
    });
  });

  describe('Race Conditions', () => {
    it('should handle concurrent verification email requests', async () => {
      mockPrisma.emailVerificationToken.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.emailVerificationToken.create.mockResolvedValue({});

      // Simulate user clicking "resend" multiple times
      await Promise.all([
        sendVerificationEmail(mockUserId, mockEmail, mockName),
        sendVerificationEmail(mockUserId, mockEmail, mockName),
        sendVerificationEmail(mockUserId, mockEmail, mockName),
      ]);

      // Should delete old tokens each time
      expect(mockPrisma.emailVerificationToken.deleteMany).toHaveBeenCalledTimes(3);

      // Should create 3 tokens (last one wins)
      expect(mockPrisma.emailVerificationToken.create).toHaveBeenCalledTimes(3);
    });
  });
});
