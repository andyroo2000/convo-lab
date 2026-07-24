import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CSRF_TOKEN_COOKIE_NAME,
  CSRF_TOKEN_HEADER_NAME,
  fetchWithCsrf,
  installCsrfFetch,
  resetCsrfStateForTests,
} from '../csrf';

describe('csrf helpers', () => {
  function jsonResponse(body: unknown, init: ResponseInit): Response {
    return new Response(JSON.stringify(body), {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
  }

  function clearTokenCookie() {
    document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }

  beforeEach(() => {
    resetCsrfStateForTests();
    clearTokenCookie();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetCsrfStateForTests();
    clearTokenCookie();
  });

  it('bootstraps Sanctum and attaches the XSRF header to unsafe API requests', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input) === '/sanctum/csrf-cookie') {
          document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=bootstrapped-token`;
          return { ok: true, status: 204 } as Response;
        }

        expect(new Headers(init?.headers).get(CSRF_TOKEN_HEADER_NAME)).toBe('bootstrapped-token');
        return { ok: true, status: 204 } as Response;
      });
    vi.stubGlobal('fetch', fetchMock);

    await fetchWithCsrf('/api/convolab/browser/auth/login', {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ email: 'a@example.com', password: 'password123' }),
    });

    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      '/sanctum/csrf-cookie',
      '/api/convolab/browser/auth/login',
    ]);
  });

  it('validates the cookie owner once, then reuses the Sanctum token', async () => {
    document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=possibly-express-token`;
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input) === '/sanctum/csrf-cookie') {
        document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=sanctum-token`;
      }
      return { ok: true, status: 204 } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchWithCsrf('/api/study/reviews', { method: 'POST' });
    await fetchWithCsrf('/api/study/reviews', { method: 'POST' });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      '/sanctum/csrf-cookie',
      '/api/study/reviews',
      '/api/study/reviews',
    ]);
    expect(new Headers(fetchMock.mock.calls[2]?.[1]?.headers).get(CSRF_TOKEN_HEADER_NAME)).toBe(
      'sanctum-token'
    );
  });

  it.each(['/api/tools-audio/signed-urls', '/api/convolab/browser/tools/analytics'])(
    'does not bootstrap CSRF for the public mutation %s',
    async (path) => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 } as Response);
      vi.stubGlobal('fetch', fetchMock);

      await fetchWithCsrf(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).has(CSRF_TOKEN_HEADER_NAME)).toBe(
        false
      );
    }
  );

  it('protects similarly named API paths instead of broadening public exemptions', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input) === '/sanctum/csrf-cookie') {
          document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=xsrf-token`;
          return { ok: true, status: 204 } as Response;
        }

        expect(new Headers(init?.headers).get(CSRF_TOKEN_HEADER_NAME)).toBe('xsrf-token');
        return { ok: false, status: 404 } as Response;
      });
    vi.stubGlobal('fetch', fetchMock);

    await fetchWithCsrf('/api/tools-audio/signed-urls-extra', { method: 'POST' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['safe API read', '/api/study/overview', { method: 'GET' }],
    ['non-API mutation', '/form-submit', { method: 'POST' }],
    ['cross-origin mutation', 'https://example.com/api/study/reviews', { method: 'POST' }],
  ])('leaves a %s unmodified', async (_label, input, init) => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 } as Response);
    vi.stubGlobal('fetch', fetchMock);

    await fetchWithCsrf(input, init);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(init);
  });

  it('preserves a caller-provided XSRF header', async () => {
    document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=cookie-token`;
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input) === '/sanctum/csrf-cookie') {
        document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=sanctum-token`;
      }
      return { ok: true, status: 204 } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchWithCsrf('/api/study/reviews', {
      method: 'POST',
      headers: { [CSRF_TOKEN_HEADER_NAME]: 'caller-token' },
    });

    expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get(CSRF_TOKEN_HEADER_NAME)).toBe(
      'caller-token'
    );
  });

  it.each([
    [419, { message: 'CSRF token mismatch.' }],
    [403, { error: { message: 'Invalid CSRF token.' } }],
  ])('refreshes the token and retries once after a %s CSRF rejection', async (status, body) => {
    document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=stale-token`;
    let mutationAttempts = 0;
    let bootstrapAttempts = 0;
    const fetchMock = vi
      .fn()
      .mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input) === '/sanctum/csrf-cookie') {
          bootstrapAttempts += 1;
          document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=${
            bootstrapAttempts === 1 ? 'stale-token' : 'fresh-token'
          }`;
          return { ok: true, status: 204 } as Response;
        }

        mutationAttempts += 1;
        const token = new Headers(init?.headers).get(CSRF_TOKEN_HEADER_NAME);
        if (mutationAttempts === 1) {
          expect(token).toBe('stale-token');
          return jsonResponse(body, { status });
        }

        expect(token).toBe('fresh-token');
        return { ok: true, status: 204 } as Response;
      });
    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchWithCsrf('/api/study/reviews', {
      method: 'POST',
      body: '{}',
    });

    expect(response.ok).toBe(true);
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      '/sanctum/csrf-cookie',
      '/api/study/reviews',
      '/sanctum/csrf-cookie',
      '/api/study/reviews',
    ]);
  });

  it('does not retry a non-CSRF 403 mutation rejection', async () => {
    document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=valid-token`;
    const fetchMock = vi
      .fn()
      .mockImplementation(async (input: RequestInfo | URL) =>
        String(input) === '/sanctum/csrf-cookie'
          ? ({ ok: true, status: 204 } as Response)
          : jsonResponse({ error: { message: 'Forbidden' } }, { status: 403 })
      );
    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchWithCsrf('/api/convolab/admin/users', {
      method: 'POST',
      body: '{}',
    });

    expect(response.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a non-JSON 403 response', async () => {
    document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=valid-token`;
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) =>
      String(input) === '/sanctum/csrf-cookie'
        ? ({ ok: true, status: 204 } as Response)
        : new Response('<html>Forbidden</html>', {
            status: 403,
            headers: { 'Content-Type': 'text/html' },
          })
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchWithCsrf('/api/convolab/admin/users', {
      method: 'POST',
      body: '{}',
    });

    expect(response.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns the retried rejection without a stale header when refresh fails', async () => {
    document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=stale-token`;
    const mutationHeaders: Headers[] = [];
    let bootstrapAttempts = 0;
    const fetchMock = vi
      .fn()
      .mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input) === '/sanctum/csrf-cookie') {
          bootstrapAttempts += 1;
          return {
            ok: bootstrapAttempts === 1,
            status: bootstrapAttempts === 1 ? 204 : 500,
          } as Response;
        }

        mutationHeaders.push(new Headers(init?.headers));
        return jsonResponse({ message: 'CSRF token mismatch.' }, { status: 419 });
      });
    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchWithCsrf('/api/study/reviews', {
      method: 'POST',
      body: '{}',
    });

    expect(response.status).toBe(419);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(mutationHeaders[0]?.get(CSRF_TOKEN_HEADER_NAME)).toBe('stale-token');
    expect(mutationHeaders[1]?.has(CSRF_TOKEN_HEADER_NAME)).toBe(false);
  });

  it('installs the same CSRF behavior for plain window.fetch calls', async () => {
    const originalFetch = vi
      .fn()
      .mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input) === '/sanctum/csrf-cookie') {
          document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=wrapped-token`;
          return { ok: true, status: 204 } as Response;
        }

        expect(new Headers(init?.headers).get(CSRF_TOKEN_HEADER_NAME)).toBe('wrapped-token');
        return { ok: true, status: 204 } as Response;
      });
    vi.stubGlobal('fetch', originalFetch);

    installCsrfFetch();
    await fetch('/api/auth/password/forgot', {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ email: 'ada@example.com' }),
    });

    expect(originalFetch.mock.calls.map(([input]) => String(input))).toEqual([
      '/sanctum/csrf-cookie',
      '/api/auth/password/forgot',
    ]);
  });
});
