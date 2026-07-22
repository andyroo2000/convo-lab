import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  authenticateLearningOsAccount,
  changeLearningOsCurrentPassword,
  deleteLearningOsCurrentAccount,
  getLearningOsCurrentAccount,
  registerLearningOsAccount,
  resetLearningOsPassword,
  sendLearningOsPasswordResetLink,
  sendLearningOsVerificationEmail,
  updateLearningOsCurrentAccount,
  verifyLearningOsEmail,
} from '../../../services/learningOsAuthProxy.js';
import { resolveLearningOsProxyContext } from '../../../services/learningOsProxy.js';
import { mockPrisma } from '../../setup.js';

const account = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'learner@example.com',
  name: 'Learner',
  displayName: null,
  avatarColor: 'indigo',
  avatarUrl: null,
  role: 'user',
  preferredStudyLanguage: 'ja',
  preferredNativeLanguage: 'en',
  proficiencyLevel: 'N3',
  onboardingCompleted: true,
  emailVerified: true,
  emailVerifiedAt: '2026-07-20T09:00:00.123Z',
  createdAt: '2026-07-20T10:00:00.123Z',
  updatedAt: '2026-07-20T11:00:00.456Z',
};

const currentAccount = {
  ...account,
  seenSampleContentGuide: true,
  seenCustomContentGuide: false,
};

const { avatarUrl: _loginAvatarUrl, ...legacyAccount } = account;
const { avatarUrl: _currentAvatarUrl, ...legacyCurrentAccount } = currentAccount;

const jsonResponse = (body: unknown, status = 200, headers?: Record<string, string>): Response =>
  new Response(JSON.stringify(body), { status, headers });

describe('Learning OS auth proxy', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      LEARNING_OS_API_URL: 'https://learning-os.example/',
      LEARNING_OS_API_TOKEN: 'server-only-token',
      LEARNING_OS_PROXY_USER_EMAIL: 'proxy@example.com',
    };
    mockPrisma.user.findUnique.mockResolvedValue({
      id: '22222222-2222-4222-8222-222222222222',
      email: 'proxy@example.com',
      role: 'admin',
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(account)));
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  it('authenticates through the service identity without changing the legacy response shape', async () => {
    await expect(
      authenticateLearningOsAccount('Learner@Example.com', 'correct password')
    ).resolves.toEqual(legacyAccount);

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'proxy@example.com' },
      select: { id: true, email: true, role: true },
    });
    const [url, init] = vi.mocked(global.fetch).mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('https://learning-os.example/api/convolab/auth/login');
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer server-only-token',
        'Content-Type': 'application/json',
        'X-Convo-Lab-User-Id': '22222222-2222-4222-8222-222222222222',
        'X-Convo-Lab-User-Email': 'proxy@example.com',
        'X-Convo-Lab-User-Role': 'admin',
      },
      body: JSON.stringify({
        email: 'Learner@Example.com',
        password: 'correct password',
      }),
    });
  });

  it('registers through the service identity and preserves the legacy account shape', async () => {
    const signupInput = {
      email: 'New@Example.com',
      password: 'correct password',
      name: 'New Learner',
      inviteCode: 'WELCOME1',
    };

    await expect(registerLearningOsAccount(signupInput)).resolves.toEqual(legacyAccount);

    const [url, init] = vi.mocked(global.fetch).mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('https://learning-os.example/api/convolab/auth/signup');
    expect(init).toMatchObject({
      method: 'POST',
      body: JSON.stringify(signupInput),
      headers: expect.objectContaining({
        Authorization: 'Bearer server-only-token',
        'X-Convo-Lab-User-Email': 'proxy@example.com',
      }),
    });
  });

  it.each([
    ['invalid_invite', 'Invalid invite code.', 400],
    ['used_invite', 'This invite code has already been used.', 400],
    ['account_exists', 'User already exists', 400],
    ['invalid_credentials', 'Invalid credentials', 401],
  ] as const)(
    'maps the %s signup failure to the legacy contract',
    async (reason, message, status) => {
      vi.mocked(global.fetch).mockResolvedValue(
        jsonResponse({ message: 'upstream detail', reason }, status)
      );

      await expect(
        registerLearningOsAccount({
          email: account.email,
          password: 'correct password',
          name: account.name,
          inviteCode: 'WELCOME1',
        })
      ).rejects.toMatchObject({
        message,
        statusCode: status,
      });
    }
  );

  it('hides Laravel validation details behind the legacy signup envelope', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      jsonResponse({ message: 'The email field must be a valid email address.', errors: {} }, 422)
    );

    await expect(
      registerLearningOsAccount({
        email: 'invalid',
        password: 'correct password',
        name: account.name,
        inviteCode: 'WELCOME1',
      })
    ).rejects.toMatchObject({ message: 'Invalid signup details', statusCode: 400 });
  });

  it('does not classify a signup reason returned with the wrong status', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      jsonResponse({ message: 'internal detail', reason: 'invalid_invite' }, 500)
    );

    await expect(
      registerLearningOsAccount({
        email: account.email,
        password: 'correct password',
        name: account.name,
        inviteCode: 'WELCOME1',
      })
    ).rejects.toMatchObject({
      message: 'Learning OS Auth API request failed.',
      statusCode: 502,
    });
  });

  it('preserves nullable and empty legacy profile values', async () => {
    const sparseAccount = {
      ...account,
      displayName: '',
      avatarColor: null,
      preferredStudyLanguage: '',
      preferredNativeLanguage: '',
      proficiencyLevel: '',
    };
    vi.mocked(global.fetch).mockResolvedValue(jsonResponse(sparseAccount));

    const { avatarUrl: _avatarUrl, ...legacySparseAccount } = sparseAccount;
    await expect(authenticateLearningOsAccount(account.email, 'password')).resolves.toEqual(
      legacySparseAccount
    );
  });

  it('loads the current account for any authenticated user without the staged email gate', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: account.id,
      email: account.email,
      role: account.role,
    });
    vi.mocked(global.fetch).mockResolvedValue(jsonResponse(currentAccount));

    await expect(getLearningOsCurrentAccount(account.id)).resolves.toEqual(legacyCurrentAccount);

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: account.id },
      select: { id: true, email: true, role: true },
    });
    const [url, init] = vi.mocked(global.fetch).mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('https://learning-os.example/api/convolab/auth/me');
    expect(init).toMatchObject({
      method: 'GET',
      headers: expect.objectContaining({
        'X-Convo-Lab-User-Id': account.id,
        'X-Convo-Lab-User-Email': account.email,
      }),
    });
  });

  it('loads a target-created current account from signed session identity without Prisma', async () => {
    vi.mocked(global.fetch).mockResolvedValue(jsonResponse(currentAccount));

    await expect(
      getLearningOsCurrentAccount(account.id, {
        userId: account.id,
        email: account.email,
        role: account.role,
        accountSource: 'learning-os',
      })
    ).resolves.toEqual(legacyCurrentAccount);

    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    const [, init] = vi.mocked(global.fetch).mock.calls[0] as [URL, RequestInit];
    expect(init.headers).toMatchObject({
      'X-Convo-Lab-User-Id': account.id,
      'X-Convo-Lab-User-Email': account.email,
      'X-Convo-Lab-User-Role': account.role,
    });
  });

  it('updates a target-created current account from signed session identity without Prisma', async () => {
    vi.mocked(global.fetch).mockResolvedValue(jsonResponse(currentAccount));
    const input = {
      displayName: 'Ada',
      avatarUrl: 'https://example.com/avatar.png',
      proficiencyLevel: 'N3' as const,
      onboardingCompleted: true,
    };

    await expect(
      updateLearningOsCurrentAccount(account.id, input, {
        userId: account.id,
        email: account.email,
        role: account.role,
        accountSource: 'learning-os',
      })
    ).resolves.toEqual(legacyCurrentAccount);

    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    const [url, init] = vi.mocked(global.fetch).mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('https://learning-os.example/api/convolab/auth/me');
    expect(init).toMatchObject({
      method: 'PATCH',
      body: JSON.stringify(input),
      headers: expect.objectContaining({
        'X-Convo-Lab-User-Id': account.id,
        'X-Convo-Lab-User-Email': account.email,
      }),
    });
  });

  it('changes a target-created account password through the canonical Learning OS action', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response(null, { status: 204 }));

    await expect(
      changeLearningOsCurrentPassword(
        account.id,
        { currentPassword: 'old-password123', newPassword: 'new-password123' },
        {
          userId: account.id,
          email: account.email,
          role: account.role,
          accountSource: 'learning-os',
        }
      )
    ).resolves.toBeUndefined();

    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    const [url, init] = vi.mocked(global.fetch).mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('https://learning-os.example/api/convolab/auth/me/password');
    expect(init).toMatchObject({
      method: 'PUT',
      body: JSON.stringify({
        current_password: 'old-password123',
        password: 'new-password123',
        password_confirmation: 'new-password123',
      }),
      headers: expect.objectContaining({
        'X-Convo-Lab-User-Id': account.id,
        'X-Convo-Lab-User-Email': account.email,
      }),
    });
  });

  it('deletes a target-created account through the canonical Learning OS action', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response(null, { status: 204 }));

    await expect(
      deleteLearningOsCurrentAccount(
        account.id,
        { currentPassword: 'correct-password123' },
        {
          userId: account.id,
          email: account.email,
          role: account.role,
          accountSource: 'learning-os',
        }
      )
    ).resolves.toBeUndefined();

    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    const [url, init] = vi.mocked(global.fetch).mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('https://learning-os.example/api/convolab/auth/me');
    expect(init).toMatchObject({
      method: 'DELETE',
      body: JSON.stringify({ current_password: 'correct-password123' }),
      headers: expect.objectContaining({
        'X-Convo-Lab-User-Id': account.id,
        'X-Convo-Lab-User-Email': account.email,
      }),
    });
  });

  it.each([
    [
      'incorrect current password',
      422,
      { message: 'Invalid.', errors: { current_password: ['Incorrect.'] } },
      'Current password is incorrect',
      401,
    ],
  ] as const)(
    'maps %s to the legacy account-deletion contract',
    async (_label, upstreamStatus, body, message, status) => {
      vi.mocked(global.fetch).mockResolvedValue(jsonResponse(body, upstreamStatus));

      await expect(
        deleteLearningOsCurrentAccount(account.id, {
          currentPassword: 'correct-password123',
        })
      ).rejects.toMatchObject({ message, statusCode: status });
    }
  );

  it('treats an already-deleted canonical account as an idempotent success', async () => {
    vi.mocked(global.fetch).mockResolvedValue(jsonResponse({ message: 'Not Found.' }, 404));

    await expect(
      deleteLearningOsCurrentAccount(account.id, {
        currentPassword: 'correct-password123',
      })
    ).resolves.toBeUndefined();
  });

  it('preserves a bounded account-deletion retry delay', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      jsonResponse({ message: 'Too Many Attempts.' }, 429, { 'Retry-After': '23' })
    );

    await expect(
      deleteLearningOsCurrentAccount(account.id, { currentPassword: 'correct-password123' })
    ).rejects.toMatchObject({
      message: 'Too many account deletion attempts.',
      statusCode: 429,
      metadata: { cooldown: { remainingSeconds: 23 } },
    });
  });

  it('rejects an unexpected successful account-deletion response', async () => {
    vi.mocked(global.fetch).mockResolvedValue(jsonResponse({ message: 'ok' }));

    await expect(
      deleteLearningOsCurrentAccount(account.id, { currentPassword: 'correct-password123' })
    ).rejects.toMatchObject({
      message: 'Learning OS Auth API returned an invalid response.',
      statusCode: 502,
    });
  });

  it.each([
    [
      'incorrect current password',
      { message: 'Invalid.', errors: { current_password: ['The password is incorrect.'] } },
      'Current password is incorrect',
      401,
    ],
    [
      'invalid new password',
      { message: 'Invalid.', errors: { password: ['The password is invalid.'] } },
      'Invalid new password',
      400,
    ],
  ] as const)(
    'maps %s to the legacy password-change contract',
    async (_label, body, message, status) => {
      vi.mocked(global.fetch).mockResolvedValue(jsonResponse(body, 422));

      await expect(
        changeLearningOsCurrentPassword(account.id, {
          currentPassword: 'old-password123',
          newPassword: 'new-password123',
        })
      ).rejects.toMatchObject({ message, statusCode: status });
    }
  );

  it('preserves a bounded password-change retry delay', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      jsonResponse({ message: 'Too Many Attempts.' }, 429, { 'Retry-After': '19' })
    );

    await expect(
      changeLearningOsCurrentPassword(account.id, {
        currentPassword: 'old-password123',
        newPassword: 'new-password123',
      })
    ).rejects.toMatchObject({
      message: 'Too many password change attempts.',
      statusCode: 429,
      metadata: { cooldown: { remainingSeconds: 19 } },
    });
  });

  it('rejects an unexpected successful password-change response', async () => {
    vi.mocked(global.fetch).mockResolvedValue(jsonResponse({ message: 'ok' }));

    await expect(
      changeLearningOsCurrentPassword(account.id, {
        currentPassword: 'old-password123',
        newPassword: 'new-password123',
      })
    ).rejects.toMatchObject({
      message: 'Learning OS Auth API returned an invalid response.',
      statusCode: 502,
    });
  });

  it.each([
    [404, { message: 'Not Found.' }, 'User not found', 404],
    [422, { message: 'Invalid.', errors: {} }, 'Invalid profile details', 400],
  ] as const)(
    'maps profile-update status %s to the legacy contract',
    async (upstreamStatus, body, message, status) => {
      vi.mocked(global.fetch).mockResolvedValue(jsonResponse(body, upstreamStatus));

      await expect(
        updateLearningOsCurrentAccount(account.id, { displayName: 'Ada' })
      ).rejects.toMatchObject({ message, statusCode: status });
    }
  );

  it('preserves a bounded profile-update retry delay', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      jsonResponse({ message: 'Too Many Attempts.' }, 429, { 'Retry-After': '17' })
    );

    await expect(
      updateLearningOsCurrentAccount(account.id, { displayName: 'Ada' })
    ).rejects.toMatchObject({
      message: 'Too many profile update attempts.',
      statusCode: 429,
      metadata: { cooldown: { remainingSeconds: 17 } },
    });
  });

  it('does not require target-only profile fields in the legacy response adapter', async () => {
    const { avatarUrl: _avatarUrl, ...upstreamWithoutAvatarUrl } = currentAccount;
    vi.mocked(global.fetch).mockResolvedValue(jsonResponse(upstreamWithoutAvatarUrl));

    await expect(
      updateLearningOsCurrentAccount(account.id, { displayName: 'Ada' })
    ).resolves.toEqual(legacyCurrentAccount);
  });

  it.each([
    {
      identity: {
        userId: account.id,
        email: ' invalid@example.com',
        role: account.role,
        accountSource: 'learning-os',
      },
      label: 'invalid email',
    },
    {
      identity: {
        userId: account.id,
        email: account.email,
        role: 'owner',
        accountSource: 'learning-os',
      },
      label: 'invalid role',
    },
    {
      identity: {
        userId: '33333333-3333-4333-8333-333333333333',
        email: account.email,
        role: account.role,
        accountSource: 'learning-os',
      },
      label: 'mismatched user',
    },
    {
      identity: { userId: account.id, email: account.email, role: account.role },
      label: 'legacy-backed source',
    },
  ] as const)(
    'falls back to legacy identity for a signed session with $label',
    async ({ identity }) => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: account.id,
        email: account.email,
        role: account.role,
      });
      vi.mocked(global.fetch).mockResolvedValue(jsonResponse(currentAccount));

      await expect(getLearningOsCurrentAccount(account.id, identity)).resolves.toEqual(
        legacyCurrentAccount
      );

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: account.id },
        select: { id: true, email: true, role: true },
      });
    }
  );

  it('preserves legacy account deletion as immediate session revocation', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(
      getLearningOsCurrentAccount(account.id, {
        userId: account.id,
        email: account.email,
        role: account.role,
      })
    ).rejects.toMatchObject({ message: 'User not found', statusCode: 404 });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('resends verification from signed session identity without a legacy user row', async () => {
    vi.mocked(global.fetch).mockResolvedValue(jsonResponse({ message: 'Verification email sent' }));

    await expect(
      sendLearningOsVerificationEmail(account.id, {
        userId: account.id,
        email: account.email,
        role: account.role,
        accountSource: 'learning-os',
      })
    ).resolves.toBeUndefined();

    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    const [url, init] = vi.mocked(global.fetch).mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('https://learning-os.example/api/convolab/auth/verification/send');
    expect(init.method).toBe('POST');
  });

  it.each([
    [400, { message: 'Email is already verified' }, 'Email already verified', 400],
    [404, { message: 'Not Found.' }, 'User not found', 404],
  ] as const)(
    'maps verification-send status %s to the legacy contract',
    async (upstreamStatus, body, message, status) => {
      vi.mocked(global.fetch).mockResolvedValue(jsonResponse(body, upstreamStatus));

      await expect(sendLearningOsVerificationEmail(account.id)).rejects.toMatchObject({
        message,
        statusCode: status,
      });
    }
  );

  it('translates the public verification token from GET path to POST body', async () => {
    const token = 'a'.repeat(64);
    vi.mocked(global.fetch).mockResolvedValue(
      jsonResponse({ message: 'Email verified successfully', email: account.email })
    );

    await expect(verifyLearningOsEmail(token)).resolves.toEqual({
      message: 'Email verified successfully',
      email: account.email,
    });

    const [url, init] = vi.mocked(global.fetch).mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('https://learning-os.example/api/convolab/auth/verification');
    expect(init).toMatchObject({ method: 'POST', body: JSON.stringify({ token }) });
  });

  it('requests a password reset through the public Learning OS broker endpoint', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response(null, { status: 204 }));

    await expect(sendLearningOsPasswordResetLink(` ${account.email} `)).resolves.toBeUndefined();

    const [url, init] = vi.mocked(global.fetch).mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('https://learning-os.example/api/auth/password/forgot');
    expect(init).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ email: account.email }),
      headers: expect.objectContaining({ Authorization: 'Bearer server-only-token' }),
    });
  });

  it.each([null, {}, [], '', 'not-an-email', `${'x'.repeat(320)}@example.com`])(
    'preserves generic success without forwarding malformed reset-link identity %#',
    async (email) => {
      await expect(sendLearningOsPasswordResetLink(email)).resolves.toBeUndefined();

      expect(global.fetch).not.toHaveBeenCalled();
    }
  );

  it('resets a password through the Learning OS broker contract', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response(null, { status: 204 }));

    await expect(
      resetLearningOsPassword({
        email: account.email,
        token: 'broker-token',
        newPassword: 'new-password123',
      })
    ).resolves.toBeUndefined();

    const [url, init] = vi.mocked(global.fetch).mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('https://learning-os.example/api/auth/password/reset');
    expect(init).toMatchObject({
      method: 'POST',
      body: JSON.stringify({
        email: account.email,
        token: 'broker-token',
        password: 'new-password123',
        password_confirmation: 'new-password123',
      }),
    });
  });

  it.each([
    ['', 'broker-token'],
    [' leading@example.com', 'broker-token'],
    ['not-an-email', 'broker-token'],
    [account.email, ''],
    [account.email, 'x'.repeat(513)],
  ])('rejects malformed password reset identity before forwarding', async (email, token) => {
    await expect(
      resetLearningOsPassword({ email, token, newPassword: 'new-password123' })
    ).rejects.toMatchObject({
      message: 'Invalid or expired password reset token',
      statusCode: 400,
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it.each([400, 422])(
    'preserves generic success when reset-link request validation fails upstream with %i',
    async (status) => {
      vi.mocked(global.fetch).mockResolvedValue(
        jsonResponse({ message: 'The given data was invalid.', errors: {} }, status)
      );

      await expect(sendLearningOsPasswordResetLink(account.email)).resolves.toBeUndefined();
    }
  );

  it('maps reset-completion validation failures to the legacy contract', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      jsonResponse({ message: 'The given data was invalid.', errors: {} }, 422)
    );

    await expect(
      resetLearningOsPassword({
        email: account.email,
        token: 'broker-token',
        newPassword: 'new-password123',
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it.each([
    ['reset request', () => sendLearningOsPasswordResetLink(account.email)],
    [
      'reset completion',
      () =>
        resetLearningOsPassword({
          email: account.email,
          token: 'broker-token',
          newPassword: 'new-password123',
        }),
    ],
  ] as const)('preserves a bounded retry delay for %s', async (_label, operation) => {
    vi.mocked(global.fetch).mockResolvedValue(
      jsonResponse({ message: 'Too Many Attempts.' }, 429, { 'Retry-After': '23' })
    );

    await expect(operation()).rejects.toMatchObject({
      message: 'Too many password reset attempts.',
      statusCode: 429,
      metadata: { cooldown: { remainingSeconds: 23 } },
    });
  });

  it.each([
    ['reset request', () => sendLearningOsPasswordResetLink(account.email)],
    [
      'reset completion',
      () =>
        resetLearningOsPassword({
          email: account.email,
          token: 'broker-token',
          newPassword: 'new-password123',
        }),
    ],
  ] as const)('rejects an unexpected successful %s response', async (_label, operation) => {
    vi.mocked(global.fetch).mockResolvedValue(jsonResponse({ message: 'ok' }));

    await expect(operation()).rejects.toMatchObject({
      message: 'Learning OS Auth API returned an invalid response.',
      statusCode: 502,
    });
  });

  it.each([
    [400, { message: 'Invalid or expired verification token' }],
    [422, { message: 'The token field format is invalid.', errors: { token: [] } }],
  ])('maps verification failure %s to the legacy invalid-token response', async (status, body) => {
    vi.mocked(global.fetch).mockResolvedValue(jsonResponse(body, status));

    await expect(verifyLearningOsEmail('b'.repeat(64))).rejects.toMatchObject({
      message: 'Invalid or expired verification token',
      statusCode: 400,
    });
  });

  it('rejects malformed verification tokens before resolving proxy identity', async () => {
    await expect(verifyLearningOsEmail('invalid-token')).rejects.toMatchObject({
      message: 'Invalid or expired verification token',
      statusCode: 400,
    });

    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['verification resend', () => sendLearningOsVerificationEmail(account.id)],
    ['verification consume', () => verifyLearningOsEmail('c'.repeat(64))],
  ] as const)('preserves a bounded retry delay for %s', async (_label, operation) => {
    vi.mocked(global.fetch).mockResolvedValue(
      jsonResponse({ message: 'Too Many Attempts.' }, 429, { 'Retry-After': '41' })
    );

    await expect(operation()).rejects.toMatchObject({
      statusCode: 429,
      metadata: { cooldown: { remainingSeconds: 41 } },
    });
  });

  it.each([
    [
      'verification resend',
      { message: 'Verification queued' },
      () => sendLearningOsVerificationEmail(account.id),
    ],
    [
      'verification consume',
      { message: 'Email verified successfully', email: 'not-an-email' },
      () => verifyLearningOsEmail('d'.repeat(64)),
    ],
  ] as const)('rejects an invalid %s success response', async (_label, body, operation) => {
    vi.mocked(global.fetch).mockResolvedValue(jsonResponse(body));

    await expect(operation()).rejects.toMatchObject({
      message: 'Learning OS Auth API returned an invalid response.',
      statusCode: 502,
    });
  });

  it('keeps the staged account restriction on existing domain proxies', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: account.id,
      email: account.email,
      role: account.role,
    });

    await expect(
      resolveLearningOsProxyContext(account.id, 'Learning OS Study API')
    ).rejects.toMatchObject({
      message: 'Learning OS Study API is not enabled for this account.',
      statusCode: 403,
    });
  });

  it('only maps the exact credential rejection to the public login failure', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      jsonResponse({ message: 'Invalid credentials.' }, 401)
    );
    await expect(authenticateLearningOsAccount(account.email, 'wrong')).rejects.toMatchObject({
      message: 'Invalid credentials',
      statusCode: 401,
    });

    vi.mocked(global.fetch).mockResolvedValueOnce(
      jsonResponse({ message: 'Unauthenticated.' }, 401)
    );
    await expect(authenticateLearningOsAccount(account.email, 'wrong')).rejects.toMatchObject({
      message: 'Learning OS Auth API request failed.',
      statusCode: 502,
    });
  });

  it('preserves a bounded retry delay when Learning OS rate limits login', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      jsonResponse({ message: 'Too Many Attempts.' }, 429, { 'Retry-After': '37' })
    );

    await expect(authenticateLearningOsAccount(account.email, 'wrong')).rejects.toMatchObject({
      statusCode: 429,
      metadata: { cooldown: { remainingSeconds: 37 } },
    });
  });

  it('drops malformed retry delays from Learning OS rate limits', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      jsonResponse({ message: 'Too Many Attempts.' }, 429, { 'Retry-After': '37seconds' })
    );

    await expect(authenticateLearningOsAccount(account.email, 'wrong')).rejects.toMatchObject({
      statusCode: 429,
      metadata: undefined,
    });
  });

  it.each([
    ['invalid JSON', new Response('{', { status: 200 }), 'returned invalid JSON.'],
    [
      'invalid account shape',
      jsonResponse({ ...account, createdAt: 'not-a-date' }),
      'returned an invalid response.',
    ],
    [
      'privileged account role',
      jsonResponse({ ...account, role: 'super-admin' }),
      'returned an invalid response.',
    ],
  ])('rejects %s from the upstream service', async (_label, response, message) => {
    vi.mocked(global.fetch).mockResolvedValue(response);

    await expect(authenticateLearningOsAccount(account.email, 'password')).rejects.toMatchObject({
      message: `Learning OS Auth API ${message}`,
      statusCode: 502,
    });
  });

  it('maps a missing projection to the existing hidden current-user response', async () => {
    vi.mocked(global.fetch).mockResolvedValue(jsonResponse({ message: 'Not Found.' }, 404));

    await expect(getLearningOsCurrentAccount(account.id)).rejects.toMatchObject({
      message: 'User not found',
      statusCode: 404,
    });
  });

  it('returns controlled errors for unavailable or incomplete proxy configuration', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('connection refused'));
    await expect(authenticateLearningOsAccount(account.email, 'password')).rejects.toMatchObject({
      message: 'Learning OS Auth API is unavailable.',
      statusCode: 502,
    });

    delete process.env.LEARNING_OS_API_TOKEN;
    await expect(authenticateLearningOsAccount(account.email, 'password')).rejects.toMatchObject({
      message: 'Learning OS Auth API is enabled but not configured.',
      statusCode: 503,
    });
  });

  it('rejects plaintext credential forwarding outside known local service hosts', async () => {
    process.env.LEARNING_OS_API_URL = 'http://learning-os.example/';

    await expect(authenticateLearningOsAccount(account.email, 'password')).rejects.toMatchObject({
      message: 'Learning OS Auth API is enabled but not configured.',
      statusCode: 503,
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('allows the production Docker service hostname over its private network', async () => {
    process.env.LEARNING_OS_API_URL = 'http://learning-os:8080/';

    await expect(authenticateLearningOsAccount(account.email, 'password')).resolves.toEqual(
      legacyAccount
    );
    expect(vi.mocked(global.fetch).mock.calls[0]?.[0].toString()).toBe(
      'http://learning-os:8080/api/convolab/auth/login'
    );
  });
});
