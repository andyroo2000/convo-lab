import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';

// Import emailService AFTER mocks
import * as emailService from '../../../services/emailService.js';

// Set env vars in hoisted context to ensure they're set before module load
vi.hoisted(() => {
  process.env.RESEND_API_KEY = 'test-resend-key';
  process.env.NODE_ENV = 'production';
});

// Create hoisted mocks
const mockPrisma = vi.hoisted(() => ({
  emailVerificationToken: {
    deleteMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
  passwordResetToken: {
    deleteMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

const mockResend = vi.hoisted(() => ({
  emails: {
    send: vi.fn(),
  },
}));

vi.mock('../../../db/client.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor() {
      return mockResend;
    }
  },
}));

// Mock i18next (required by emailService)
vi.mock('../../../i18n/index.js', () => {
  const mockT = vi.fn((key: string, params?: any) => {
    // Return translated strings matching test expectations with interpolation
    const translations: Record<string, (p?: any) => string> = {
      'verification.subject': () => 'Verify your ConvoLab email',
      'passwordReset.subject': () => 'Reset your ConvoLab password',
      'welcome.subject': () => 'Welcome to ConvoLab!',
      'passwordChanged.subject': () => 'Your ConvoLab password was changed',
      'subscriptionConfirmed.subject': (p) => `Welcome to ConvoLab ${p?.tier || 'Pro'}!`,
      'paymentFailed.subject': () => 'ConvoLab payment failed - Action required',
      'subscriptionCanceled.subject': () => 'Your ConvoLab subscription has been canceled',
      'quotaWarning.subject': (p) =>
        `You've used ${p?.percentage || 80}% of your weekly ConvoLab quota`,
    };
    return translations[key] ? translations[key](params) : key;
  });
  return {
    default: {
      getFixedT: vi.fn(() => mockT),
      t: mockT,
    },
    t: mockT,
    getFixedT: vi.fn(() => mockT),
  };
});

// Mock email templates
vi.mock('../../../i18n/emailTemplates.js', () => ({
  generateVerificationEmail: vi.fn(
    (params: any) =>
      `<html>Verification Email for ${params.name} - ${params.verificationUrl}</html>`
  ),
  generatePasswordResetEmail: vi.fn(
    (params: any) => `<html>Password Reset Email for ${params.name} - ${params.resetUrl}</html>`
  ),
  generateWelcomeEmail: vi.fn((params: any) => `<html>Welcome Email for ${params.name}</html>`),
  generatePasswordChangedEmail: vi.fn(
    (params: any) => `<html>Password Changed for ${params.name}</html>`
  ),
  generateSubscriptionConfirmedEmail: vi.fn(
    (params: any) =>
      `<html>Subscription Confirmed for ${params.tier} - ${params.weeklyLimit} generations per week</html>`
  ),
  generatePaymentFailedEmail: vi.fn(
    (params: any) => `<html>Payment Failed for ${params.name}</html>`
  ),
  generateSubscriptionCanceledEmail: vi.fn(
    (params: any) =>
      `<html>Subscription Canceled for ${params.name} - downgraded to the Free tier</html>`
  ),
  generateQuotaWarningEmail: vi.fn((params: any) => {
    const upgradeText = params.tier === 'free' ? 'Upgrade to Pro for 30 generations per week' : '';
    return `<html>Quota Warning ${params.percentage}% for ${params.name} - Used: ${params.used}/${params.limit} - ${params.tier} tier - quota resets every Monday${upgradeText ? ` - ${upgradeText}` : ''}</html>`;
  }),
}));

// Mock console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe('Email Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.log = vi.fn();
    console.error = vi.fn();

    // Mock user lookup for getUserLocaleByEmail
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'test-user',
      preferredNativeLanguage: 'en',
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('sendVerificationEmail', () => {
    it('should create token and log in development mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      mockPrisma.emailVerificationToken.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.emailVerificationToken.create.mockResolvedValue({
        userId: 'test-user-id',
        token: 'test-token',
        expiresAt: new Date(),
      });

      await emailService.sendVerificationEmail('test-user-id', 'test@example.com', 'Test User');

      expect(mockPrisma.emailVerificationToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'test-user-id' },
      });
      expect(mockPrisma.emailVerificationToken.create).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });

    it('should send email in production mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      mockPrisma.emailVerificationToken.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.emailVerificationToken.create.mockResolvedValue({
        userId: 'test-user-id',
        token: 'test-token',
        expiresAt: new Date(),
      });
      mockResend.emails.send.mockResolvedValue({ id: 'email-id' });

      await emailService.sendVerificationEmail('test-user-id', 'test@example.com', 'Test User');

      expect(mockResend.emails.send).toHaveBeenCalled();
      const emailCall = mockResend.emails.send.mock.calls[0][0];
      expect(emailCall.to).toBe('test@example.com');
      expect(emailCall.subject).toBe('Verify your ConvoLab email');
      expect(emailCall.html).toContain('Test User');

      process.env.NODE_ENV = originalEnv;
    });

    it('should throw error if email sending fails', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      mockPrisma.emailVerificationToken.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.emailVerificationToken.create.mockResolvedValue({
        userId: 'test-user-id',
        token: 'test-token',
        expiresAt: new Date(),
      });
      mockResend.emails.send.mockRejectedValue(new Error('Email service error'));

      await expect(
        emailService.sendVerificationEmail('test-user-id', 'test@example.com', 'Test User')
      ).rejects.toThrow('Failed to send verification email');

      process.env.NODE_ENV = originalEnv;
    });

    it('should delete existing tokens before creating new one', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      mockPrisma.emailVerificationToken.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.emailVerificationToken.create.mockResolvedValue({
        userId: 'test-user-id',
        token: 'test-token',
        expiresAt: new Date(),
      });

      await emailService.sendVerificationEmail('test-user-id', 'test@example.com', 'Test User');

      expect(mockPrisma.emailVerificationToken.deleteMany).toHaveBeenCalledBefore(
        mockPrisma.emailVerificationToken.create as any
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should create token and log in development mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      mockPrisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.passwordResetToken.create.mockResolvedValue({
        userId: 'test-user-id',
        token: 'test-token',
        expiresAt: new Date(),
      });

      await emailService.sendPasswordResetEmail('test-user-id', 'test@example.com', 'Test User');

      expect(mockPrisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'test-user-id' },
      });
      expect(mockPrisma.passwordResetToken.create).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });

    it('should send email in production mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      mockPrisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.passwordResetToken.create.mockResolvedValue({
        userId: 'test-user-id',
        token: 'test-token',
        expiresAt: new Date(),
      });
      mockResend.emails.send.mockResolvedValue({ id: 'email-id' });

      await emailService.sendPasswordResetEmail('test-user-id', 'test@example.com', 'Test User');

      expect(mockResend.emails.send).toHaveBeenCalled();
      const emailCall = mockResend.emails.send.mock.calls[0][0];
      expect(emailCall.to).toBe('test@example.com');
      expect(emailCall.subject).toBe('Reset your ConvoLab password');
      expect(emailCall.html).toContain('Test User');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('verifyEmailToken', () => {
    it('should verify valid token and mark user as verified', async () => {
      const mockToken = {
        userId: 'test-user-id',
        token: 'valid-token',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Future date
        user: {
          email: 'test@example.com',
        },
      };

      mockPrisma.emailVerificationToken.findUnique.mockResolvedValue(mockToken);
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.emailVerificationToken.delete.mockResolvedValue({});

      const result = await emailService.verifyEmailToken('valid-token');

      expect(result).toEqual({
        userId: 'test-user-id',
        email: 'test@example.com',
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'test-user-id' },
        data: {
          emailVerified: true,
          emailVerifiedAt: expect.any(Date),
        },
      });
      expect(mockPrisma.emailVerificationToken.delete).toHaveBeenCalledWith({
        where: { token: 'valid-token' },
      });
    });

    it('should return null for non-existent token', async () => {
      mockPrisma.emailVerificationToken.findUnique.mockResolvedValue(null);

      const result = await emailService.verifyEmailToken('invalid-token');

      expect(result).toBeNull();
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should return null and delete expired token', async () => {
      const mockToken = {
        userId: 'test-user-id',
        token: 'expired-token',
        expiresAt: new Date(Date.now() - 1000), // Past date
        user: {
          email: 'test@example.com',
        },
      };

      mockPrisma.emailVerificationToken.findUnique.mockResolvedValue(mockToken);
      mockPrisma.emailVerificationToken.delete.mockResolvedValue({});

      const result = await emailService.verifyEmailToken('expired-token');

      expect(result).toBeNull();
      expect(mockPrisma.emailVerificationToken.delete).toHaveBeenCalledWith({
        where: { token: 'expired-token' },
      });
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('verifyPasswordResetToken', () => {
    it('should verify valid password reset token', async () => {
      const mockToken = {
        userId: 'test-user-id',
        token: 'valid-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // Future date
        usedAt: null,
        user: {
          email: 'test@example.com',
        },
      };

      mockPrisma.passwordResetToken.findUnique.mockResolvedValue(mockToken);

      const result = await emailService.verifyPasswordResetToken('valid-token');

      expect(result).toEqual({
        userId: 'test-user-id',
        email: 'test@example.com',
      });
    });

    it('should return null for non-existent token', async () => {
      mockPrisma.passwordResetToken.findUnique.mockResolvedValue(null);

      const result = await emailService.verifyPasswordResetToken('invalid-token');

      expect(result).toBeNull();
    });

    it('should return null and delete expired token', async () => {
      const mockToken = {
        userId: 'test-user-id',
        token: 'expired-token',
        expiresAt: new Date(Date.now() - 1000), // Past date
        usedAt: null,
        user: {
          email: 'test@example.com',
        },
      };

      mockPrisma.passwordResetToken.findUnique.mockResolvedValue(mockToken);
      mockPrisma.passwordResetToken.delete.mockResolvedValue({});

      const result = await emailService.verifyPasswordResetToken('expired-token');

      expect(result).toBeNull();
      expect(mockPrisma.passwordResetToken.delete).toHaveBeenCalledWith({
        where: { token: 'expired-token' },
      });
    });

    it('should return null for already used token', async () => {
      const mockToken = {
        userId: 'test-user-id',
        token: 'used-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // Future date
        usedAt: new Date(), // Already used
        user: {
          email: 'test@example.com',
        },
      };

      mockPrisma.passwordResetToken.findUnique.mockResolvedValue(mockToken);

      const result = await emailService.verifyPasswordResetToken('used-token');

      expect(result).toBeNull();
    });
  });

  describe('markPasswordResetTokenUsed', () => {
    it('should mark token as used', async () => {
      mockPrisma.passwordResetToken.update.mockResolvedValue({});

      await emailService.markPasswordResetTokenUsed('test-token');

      expect(mockPrisma.passwordResetToken.update).toHaveBeenCalledWith({
        where: { token: 'test-token' },
        data: { usedAt: expect.any(Date) },
      });
    });
  });

  describe('sendWelcomeEmail', () => {
    it('should send welcome email', async () => {
      mockResend.emails.send.mockResolvedValue({ id: 'email-id' });

      await emailService.sendWelcomeEmail('test@example.com', 'Test User');

      expect(mockResend.emails.send).toHaveBeenCalled();
      const emailCall = mockResend.emails.send.mock.calls[0][0];
      expect(emailCall.to).toBe('test@example.com');
      expect(emailCall.subject).toBe('Welcome to ConvoLab!');
      expect(emailCall.html).toContain('Test User');
    });

    it('should not throw if email fails', async () => {
      mockResend.emails.send.mockRejectedValue(new Error('Email service error'));

      await expect(
        emailService.sendWelcomeEmail('test@example.com', 'Test User')
      ).resolves.not.toThrow();
    });
  });

  describe('sendPasswordChangedEmail', () => {
    it('should send password changed confirmation email', async () => {
      mockResend.emails.send.mockResolvedValue({ id: 'email-id' });

      await emailService.sendPasswordChangedEmail('test@example.com', 'Test User');

      expect(mockResend.emails.send).toHaveBeenCalled();
      const emailCall = mockResend.emails.send.mock.calls[0][0];
      expect(emailCall.to).toBe('test@example.com');
      expect(emailCall.subject).toBe('Your ConvoLab password was changed');
      expect(emailCall.html).toContain('Test User');
    });

    it('should not throw if email fails', async () => {
      mockResend.emails.send.mockRejectedValue(new Error('Email service error'));

      await expect(
        emailService.sendPasswordChangedEmail('test@example.com', 'Test User')
      ).resolves.not.toThrow();
    });
  });

  describe('sendSubscriptionConfirmedEmail', () => {
    it('should send subscription confirmed email for pro tier', async () => {
      mockResend.emails.send.mockResolvedValue({ id: 'email-id' });

      await emailService.sendSubscriptionConfirmedEmail('test@example.com', 'Test User', 'pro');

      expect(mockResend.emails.send).toHaveBeenCalled();
      const emailCall = mockResend.emails.send.mock.calls[0][0];
      expect(emailCall.to).toBe('test@example.com');
      expect(emailCall.subject).toBe('Welcome to ConvoLab Pro!');
      expect(emailCall.html).toContain('30 generations per week');
    });

    it('should send subscription confirmed email for free tier', async () => {
      mockResend.emails.send.mockResolvedValue({ id: 'email-id' });

      await emailService.sendSubscriptionConfirmedEmail('test@example.com', 'Test User', 'free');

      expect(mockResend.emails.send).toHaveBeenCalled();
      const emailCall = mockResend.emails.send.mock.calls[0][0];
      expect(emailCall.html).toContain('5 generations per week');
    });
  });

  describe('sendPaymentFailedEmail', () => {
    it('should send payment failed notification', async () => {
      mockResend.emails.send.mockResolvedValue({ id: 'email-id' });

      await emailService.sendPaymentFailedEmail('test@example.com', 'Test User');

      expect(mockResend.emails.send).toHaveBeenCalled();
      const emailCall = mockResend.emails.send.mock.calls[0][0];
      expect(emailCall.to).toBe('test@example.com');
      expect(emailCall.subject).toContain('payment failed');
    });
  });

  describe('sendSubscriptionCanceledEmail', () => {
    it('should send subscription canceled notification', async () => {
      mockResend.emails.send.mockResolvedValue({ id: 'email-id' });

      await emailService.sendSubscriptionCanceledEmail('test@example.com', 'Test User');

      expect(mockResend.emails.send).toHaveBeenCalled();
      const emailCall = mockResend.emails.send.mock.calls[0][0];
      expect(emailCall.to).toBe('test@example.com');
      expect(emailCall.subject).toContain('canceled');
      expect(emailCall.html).toContain('downgraded to the Free tier');
    });
  });

  describe('sendQuotaWarningEmail', () => {
    it('should send quota warning for free tier with upgrade prompt', async () => {
      mockResend.emails.send.mockResolvedValue({ id: 'email-id' });

      await emailService.sendQuotaWarningEmail('test@example.com', 'Test User', 4, 5, 'free');

      expect(mockResend.emails.send).toHaveBeenCalled();
      const emailCall = mockResend.emails.send.mock.calls[0][0];
      expect(emailCall.subject).toContain('80%');
      expect(emailCall.html).toContain('Upgrade to Pro');
    });

    it('should send quota warning for pro tier without upgrade prompt', async () => {
      mockResend.emails.send.mockResolvedValue({ id: 'email-id' });

      await emailService.sendQuotaWarningEmail('test@example.com', 'Test User', 24, 30, 'pro');

      expect(mockResend.emails.send).toHaveBeenCalled();
      const emailCall = mockResend.emails.send.mock.calls[0][0];
      expect(emailCall.html).not.toContain('Upgrade to Pro');
      expect(emailCall.html).toContain('quota resets');
    });

    it('should calculate percentage correctly', async () => {
      mockResend.emails.send.mockResolvedValue({ id: 'email-id' });

      await emailService.sendQuotaWarningEmail('test@example.com', 'Test User', 4, 5, 'free');

      const emailCall = mockResend.emails.send.mock.calls[0][0];
      expect(emailCall.subject).toContain('80%');
    });
  });
});
