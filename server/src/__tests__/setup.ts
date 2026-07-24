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
          passwordResetSuccess: 'Password reset successfully',
        },
        validation: {
          jlptLevel: 'Invalid JLPT level. Must be N5, N4, N3, N2, or N1.',
          itemCount: 'Invalid item count. Must be 10 or 15.',
          grammarPoint: 'Invalid grammar point.',
          grammarPointMismatch:
            'Grammar point "{{point}}" is for {{expected}} level, but you selected {{actual}}.',
        },
        rateLimit: {
          cooldown: 'Please wait {{seconds}} seconds before generating more content.',
          quotaExceeded:
            "Monthly quota exceeded. You've used {{used}} of {{limit}} content generations this month.",
        },
      },
    },
  },
  interpolation: {
    escapeValue: false,
  },
});

// Mock environment variables
process.env.NODE_ENV = 'test';

// Create a mock Prisma client with common methods
const mockPrismaBase = {
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
  audioScriptMedia: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  audioScript: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  audioScriptSegment: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  audioScriptRender: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
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
  sentenceScriptTest: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  $executeRaw: vi.fn(),
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
};

export const mockPrisma = mockPrismaBase;

mockPrisma.$transaction.mockImplementation((callbackOrOperations: unknown) =>
  Array.isArray(callbackOrOperations)
    ? Promise.all(callbackOrOperations)
    : (callbackOrOperations as (client: typeof mockPrisma) => unknown)(mockPrisma)
);

// Mock the prisma module - this must be before any imports that use prisma
vi.mock('../db/client.js', () => ({
  prisma: mockPrisma,
}));

// Reset all mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});
