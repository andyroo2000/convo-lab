import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  authenticateLearningOsAccount,
  getLearningOsCurrentAccount,
} from '../../../services/learningOsAuthProxy.js';
import { resolveLearningOsProxyContext } from '../../../services/learningOsProxy.js';
import { mockPrisma } from '../../setup.js';

const account = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'learner@example.com',
  name: 'Learner',
  displayName: null,
  avatarColor: 'indigo',
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
    ).resolves.toEqual(account);

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

    await expect(authenticateLearningOsAccount(account.email, 'password')).resolves.toEqual(
      sparseAccount
    );
  });

  it('loads the current account for any authenticated user without the staged email gate', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: account.id,
      email: account.email,
      role: account.role,
    });
    vi.mocked(global.fetch).mockResolvedValue(jsonResponse(currentAccount));

    await expect(getLearningOsCurrentAccount(account.id)).resolves.toEqual(currentAccount);

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
});
