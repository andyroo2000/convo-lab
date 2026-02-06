import i18next from 'i18next';
import { vi, beforeEach } from 'vitest';
// eslint-disable-next-line import/no-named-as-default-member -- i18next default export is used correctly

// Initialize i18next for tests with inline resources
// eslint-disable-next-line import/no-named-as-default-member
i18next.init({
  lng: 'en',
  fallbackLng: 'en',
  ns: ['email', 'server'],
  defaultNS: 'email',
  resources: {
    en: {
      server: {
        errors: {
          internal: 'Internal server error',
          authRequired: 'Authentication required',
        },
        auth: {
          userNotFound: 'User not found',
        },
        verification: {
          emailAlreadyVerified: 'Email already verified',
          emailSent: 'Verification email sent',
          tokenInvalid: 'Invalid or expired verification token',
          emailVerified: 'Email verified successfully',
          emailRequired: 'Email is required',
          passwordResetSent:
            'If an account exists with that email, a password reset link has been sent',
          tokenAndPasswordRequired: 'Token and new password are required',
          passwordTooShort: 'Password must be at least 8 characters',
          passwordResetTokenInvalid: 'Invalid or expired password reset token',
          passwordResetSuccess: 'Password reset successfully',
        },
        validation: {
          jlptLevel: 'Invalid JLPT level. Must be N5, N4, N3, or N2.',
          itemCount: 'Invalid item count. Must be 10 or 15.',
          grammarPoint: 'Invalid grammar point.',
          grammarPointMismatch:
            'Grammar point "{{point}}" is for {{expected}} level, but you selected {{actual}}.',
        },
        rateLimit: {
          cooldown: 'Please wait {{seconds}} seconds before generating more content.',
          quotaExceeded:
            "Weekly quota exceeded. You've used {{used}} of {{limit}} content generations this week.",
        },
        billing: {
          priceIdRequired: 'Price ID is required',
          invalidPriceId: 'Invalid price ID',
          testTierOnly: 'Test tier is only available for test users',
          checkoutFailed: 'Failed to create checkout session',
          portalFailed: 'Failed to create portal session',
          subscriptionFailed: 'Failed to get subscription status',
          noSignature: 'No signature provided',
          webhookSecretMissing: 'Webhook secret not configured',
          signatureVerificationFailed: 'Signature verification failed',
          webhookProcessingFailed: 'Failed to process webhook',
        },
      },
    },
  },
  interpolation: {
    escapeValue: false,
  },
});

// Mock environment variables
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.NODE_ENV = 'test';

// Create a mock Prisma client with common methods
export const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  episode: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  dialogue: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  sentence: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    createMany: vi.fn(),
  },
  speaker: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  course: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  inviteCode: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  featureFlag: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
  subscriptionEvent: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  generationLog: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  emailVerificationToken: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  passwordResetToken: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  deck: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  card: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  review: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  courseCoreItem: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  $transaction: vi.fn((callback) => callback(mockPrisma)),
};

// Mock the prisma module - this must be before any imports that use prisma
vi.mock('../db/client.js', () => ({
  prisma: mockPrisma,
}));

// Reset all mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});
