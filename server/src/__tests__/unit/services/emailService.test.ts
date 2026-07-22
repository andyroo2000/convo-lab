import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { sendPasswordChangedEmail } from '../../../services/emailService.js';

vi.hoisted(() => {
  process.env.RESEND_API_KEY = 'test-resend-key';
});

const mockPrisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
}));
const mockResend = vi.hoisted(() => ({
  emails: { send: vi.fn() },
}));

vi.mock('../../../db/client.js', () => ({ prisma: mockPrisma }));
vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor() {
      return mockResend;
    }
  },
}));
vi.mock('../../../i18n/index.js', () => ({
  default: {
    getFixedT: vi.fn(
      () => (key: string) =>
        key === 'passwordChanged.subject' ? 'Your ConvoLab password was changed' : key
    ),
  },
}));
vi.mock('../../../i18n/emailTemplates.js', () => ({
  generatePasswordChangedEmail: vi.fn(
    (params: { name: string }) => `<html>Password Changed for ${params.name}</html>`
  ),
}));

// eslint-disable-next-line no-console
const originalConsoleLog = console.log;
// eslint-disable-next-line no-console
const originalConsoleError = console.error;

describe('Email Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line no-console
    console.log = vi.fn();
    // eslint-disable-next-line no-console
    console.error = vi.fn();
    mockPrisma.user.findUnique.mockResolvedValue({ preferredNativeLanguage: 'en' });
  });

  afterEach(() => {
    // eslint-disable-next-line no-console
    console.log = originalConsoleLog;
    // eslint-disable-next-line no-console
    console.error = originalConsoleError;
  });

  it('sends password-change notifications using the user locale', async () => {
    mockResend.emails.send.mockResolvedValue({ id: 'email-id' });

    await sendPasswordChangedEmail('test@example.com', 'Test User');

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'test@example.com' },
      select: { preferredNativeLanguage: true },
    });
    expect(mockResend.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        subject: 'Your ConvoLab password was changed',
        html: expect.stringContaining('Test User'),
      })
    );
  });

  it('does not fail a completed password change when notification delivery fails', async () => {
    mockResend.emails.send.mockRejectedValue(new Error('Email service error'));

    await expect(sendPasswordChangedEmail('test@example.com', 'Test User')).resolves.not.toThrow();
  });
});
