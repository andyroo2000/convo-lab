import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '../../../middleware/errorHandler.js';
import {
  authenticateLearningOsBrowserSession,
  destroyLearningOsBrowserSession,
  getLearningOsBrowserCurrentAccount,
  getLearningOsBrowserSessionCookieName,
  isLearningOsBrowserSessionEnabled,
  registerLearningOsBrowserSession,
} from '../../../services/learningOsBrowserSession.js';

const loginAccount = {
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
  ...loginAccount,
  seenSampleContentGuide: true,
  seenCustomContentGuide: false,
};

function response(body: string, status: number, setCookies: readonly string[] = []): Response {
  const headers = new Headers();
  if (body) {
    headers.set('Content-Type', 'application/json');
  }
  for (const cookie of setCookies) {
    headers.append('Set-Cookie', cookie);
  }

  return new Response(body || null, { status, headers });
}

function csrfResponse(session = 'bootstrap-session'): Response {
  return response('', 204, [
    `learning_os_session=${session}; Path=/; Secure; HttpOnly; SameSite=Lax`,
    'XSRF-TOKEN=csrf%20token; Path=/; Secure; SameSite=Lax',
  ]);
}

function requestHeaders(call: unknown[]): Headers {
  const init = call[1] as RequestInit;
  return new Headers(init.headers);
}

describe('Learning OS browser session transport', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('LEARNING_OS_API_URL', 'https://learning-os.example');
    vi.stubEnv('CLIENT_URL', 'https://convo-lab.test');
    vi.stubEnv('NODE_ENV', 'production');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('starts a login session with a stateful CSRF handshake and relays the rotated cookie', async () => {
    const rotatedCookie =
      'learning_os_session=rotated%2Fsession%3D%3D; Path=/upstream-only; SameSite=None';
    fetchMock
      .mockResolvedValueOnce(csrfResponse())
      .mockResolvedValueOnce(
        response(JSON.stringify(loginAccount), 200, [
          rotatedCookie,
          'XSRF-TOKEN=rotated%20csrf; Path=/; Secure; SameSite=Lax',
        ])
      );

    await expect(
      authenticateLearningOsBrowserSession(loginAccount.email, 'correct password')
    ).resolves.toEqual({
      account: loginAccount,
      sessionCookieValue: 'rotated/session==',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'https://learning-os.example/sanctum/csrf-cookie'
    );
    expect(String(fetchMock.mock.calls[1][0])).toBe(
      'https://learning-os.example/api/convolab/browser/auth/login'
    );
    expect(requestHeaders(fetchMock.mock.calls[1]).get('Cookie')).toBe(
      'learning_os_session=bootstrap-session; XSRF-TOKEN=csrf%20token'
    );
    expect(requestHeaders(fetchMock.mock.calls[1]).get('X-XSRF-TOKEN')).toBe('csrf token');
    expect(requestHeaders(fetchMock.mock.calls[1]).get('Origin')).toBe('https://convo-lab.test');
    expect(requestHeaders(fetchMock.mock.calls[1]).get('Referer')).toBe('https://convo-lab.test/');
    expect(JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body))).toEqual({
      email: loginAccount.email,
      password: 'correct password',
    });
  });

  it('starts signup through the same browser-session contract', async () => {
    const signupAccount = { ...loginAccount, emailVerified: false, emailVerifiedAt: null };
    fetchMock
      .mockResolvedValueOnce(csrfResponse())
      .mockResolvedValueOnce(
        response(JSON.stringify(signupAccount), 200, [
          'learning_os_session=signup-session; Path=/; Secure; HttpOnly; SameSite=Lax',
        ])
      );

    const input = {
      email: signupAccount.email,
      password: 'correct password',
      name: signupAccount.name,
      inviteCode: 'WELCOME1',
    };

    await expect(registerLearningOsBrowserSession(input)).resolves.toMatchObject({
      account: signupAccount,
      sessionCookieValue: 'signup-session',
    });
    expect(String(fetchMock.mock.calls[1][0])).toBe(
      'https://learning-os.example/api/convolab/browser/auth/signup'
    );
    expect(JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body))).toEqual(input);
  });

  it('loads the current account using only the opaque Laravel session cookie', async () => {
    fetchMock.mockResolvedValueOnce(response(JSON.stringify(currentAccount), 200));

    await expect(getLearningOsBrowserCurrentAccount('opaque-session')).resolves.toEqual(
      currentAccount
    );

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'https://learning-os.example/api/convolab/browser/auth/me'
    );
    expect(requestHeaders(fetchMock.mock.calls[0]).get('Cookie')).toBe(
      'learning_os_session=opaque-session'
    );
    expect(requestHeaders(fetchMock.mock.calls[0]).has('Authorization')).toBe(false);
  });

  it('re-encodes cookie-parser-decoded Laravel session padding before forwarding', async () => {
    fetchMock.mockResolvedValueOnce(response(JSON.stringify(currentAccount), 200));

    await getLearningOsBrowserCurrentAccount('encrypted/session==');

    expect(requestHeaders(fetchMock.mock.calls[0]).get('Cookie')).toBe(
      'learning_os_session=encrypted%2Fsession%3D%3D'
    );
  });

  it('uses the configured Laravel session cookie name', async () => {
    vi.stubEnv('LEARNING_OS_SESSION_COOKIE', 'canonical_session');
    fetchMock.mockResolvedValueOnce(response(JSON.stringify(currentAccount), 200));

    await getLearningOsBrowserCurrentAccount('opaque-session');

    expect(getLearningOsBrowserSessionCookieName()).toBe('canonical_session');
    expect(requestHeaders(fetchMock.mock.calls[0]).get('Cookie')).toBe(
      'canonical_session=opaque-session'
    );
  });

  it('maps an expired browser session to the public authentication contract', async () => {
    fetchMock.mockResolvedValueOnce(response(JSON.stringify({ message: 'Unauthenticated.' }), 401));

    await expect(getLearningOsBrowserCurrentAccount('expired-session')).rejects.toMatchObject({
      message: 'Authentication required',
      statusCode: 401,
    });
  });

  it('revokes a browser session after refreshing its Laravel CSRF token', async () => {
    fetchMock
      .mockResolvedValueOnce(csrfResponse('opaque-session'))
      .mockResolvedValueOnce(response('', 204));

    await expect(destroyLearningOsBrowserSession('opaque-session')).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestHeaders(fetchMock.mock.calls[0]).get('Cookie')).toBe(
      'learning_os_session=opaque-session'
    );
    expect(String(fetchMock.mock.calls[1][0])).toBe(
      'https://learning-os.example/api/convolab/browser/auth/logout'
    );
    expect(requestHeaders(fetchMock.mock.calls[1]).get('Cookie')).toBe(
      'learning_os_session=opaque-session; XSRF-TOKEN=csrf%20token'
    );
    expect(requestHeaders(fetchMock.mock.calls[1]).get('X-XSRF-TOKEN')).toBe('csrf token');
  });

  it('treats an already-expired upstream logout as idempotent', async () => {
    fetchMock
      .mockResolvedValueOnce(csrfResponse('expired-session'))
      .mockResolvedValueOnce(response(JSON.stringify({ message: 'Unauthenticated.' }), 401));

    await expect(destroyLearningOsBrowserSession('expired-session')).resolves.toBeUndefined();
  });

  it.each(['', 'contains space', 'contains;separator', 'a'.repeat(4097)])(
    'rejects malformed session cookie value %j before making a request',
    async (cookie) => {
      await expect(getLearningOsBrowserCurrentAccount(cookie)).rejects.toBeInstanceOf(AppError);
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  it('rejects a successful login response that omits the rotated session cookie', async () => {
    fetchMock
      .mockResolvedValueOnce(csrfResponse())
      .mockResolvedValueOnce(response(JSON.stringify(loginAccount), 200));

    await expect(
      authenticateLearningOsBrowserSession(loginAccount.email, 'correct password')
    ).rejects.toMatchObject({
      statusCode: 502,
      message: 'Learning OS Browser Session API request failed.',
    });
  });

  it('enables the bridge only for an explicit true value', () => {
    expect(getLearningOsBrowserSessionCookieName()).toBe('learning_os_session');
    expect(isLearningOsBrowserSessionEnabled()).toBe(false);

    vi.stubEnv('LEARNING_OS_BROWSER_SESSION_ENABLED', ' TRUE ');
    expect(isLearningOsBrowserSessionEnabled()).toBe(true);

    vi.stubEnv('LEARNING_OS_BROWSER_SESSION_ENABLED', '1');
    expect(isLearningOsBrowserSessionEnabled()).toBe(false);
  });

  it('rejects an invalid configured session cookie name', () => {
    vi.stubEnv('LEARNING_OS_SESSION_COOKIE', 'invalid cookie');

    expect(() => getLearningOsBrowserSessionCookieName()).toThrow(
      'Learning OS Browser Session API is enabled but not configured.'
    );
  });
});
