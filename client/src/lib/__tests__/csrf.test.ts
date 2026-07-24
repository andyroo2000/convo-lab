import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { API_URL } from '../../config';
import {
  CSRF_TOKEN_COOKIE_NAME,
  CSRF_TOKEN_HEADER_NAME,
  LEARNING_OS_CSRF_TOKEN_HEADER_NAME,
  fetchWithCsrf,
  getCsrfProviderForPath,
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

  beforeEach(() => {
    resetCsrfStateForTests();
    document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetCsrfStateForTests();
    document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  });

  it('bootstraps a token and attaches the shared header on unsafe API requests', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === `${API_URL}/api/auth/csrf`) {
          document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=bootstrapped-token`;
          return {
            ok: true,
            status: 204,
          } as Response;
        }

        expect(init?.headers).toBeDefined();
        const headers = new Headers(init?.headers);
        expect(headers.get(CSRF_TOKEN_HEADER_NAME)).toBe('bootstrapped-token');
        return {
          ok: true,
          json: async () => ({}),
        } as Response;
      });

    vi.stubGlobal('fetch', fetchMock);

    await fetchWithCsrf(`${API_URL}/api/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@example.com', password: 'password123' }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${API_URL}/api/auth/csrf`);
  });

  it('switches to the Learning OS CSRF contract for direct compatibility mutations', async () => {
    document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=express-token`;
    const fetchMock = vi
      .fn()
      .mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === '/sanctum/csrf-cookie') {
          document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=learning-os-token`;
          return { ok: true, status: 204 } as Response;
        }

        const headers = new Headers(init?.headers);
        expect(headers.get(LEARNING_OS_CSRF_TOKEN_HEADER_NAME)).toBe('learning-os-token');
        expect(headers.has(CSRF_TOKEN_HEADER_NAME)).toBe(false);
        return { ok: true, status: 204 } as Response;
      });
    vi.stubGlobal('fetch', fetchMock);

    await fetchWithCsrf('/api/convolab/auth/me', {
      method: 'DELETE',
      credentials: 'include',
      body: JSON.stringify({ current_password: 'password' }),
    });

    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      '/sanctum/csrf-cookie',
      '/api/convolab/auth/me',
    ]);
  });

  it('re-bootstraps Express CSRF after a direct Learning OS mutation', async () => {
    document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=express-token`;
    const fetchMock = vi
      .fn()
      .mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === '/sanctum/csrf-cookie') {
          document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=learning-os-token`;
          return { ok: true, status: 204 } as Response;
        }
        if (url === `${API_URL}/api/auth/csrf`) {
          document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=refreshed-express-token`;
          return { ok: true, status: 204 } as Response;
        }

        const headers = new Headers(init?.headers);
        if (url.includes('/api/convolab/auth/')) {
          expect(headers.get(LEARNING_OS_CSRF_TOKEN_HEADER_NAME)).toBe('learning-os-token');
        } else {
          expect(headers.get(CSRF_TOKEN_HEADER_NAME)).toBe('refreshed-express-token');
        }
        return { ok: true, status: 204 } as Response;
      });
    vi.stubGlobal('fetch', fetchMock);

    await fetchWithCsrf('/api/convolab/auth/me', {
      method: 'PATCH',
      credentials: 'include',
      body: '{}',
    });
    await fetchWithCsrf(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });

    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      '/sanctum/csrf-cookie',
      '/api/convolab/auth/me',
      `${API_URL}/api/auth/csrf`,
      `${API_URL}/api/auth/logout`,
    ]);
  });

  it('keeps unrelated Convo Lab mutations on the Express CSRF provider', async () => {
    document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=express-token`;
    const fetchMock = vi
      .fn()
      .mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        expect(headers.get(CSRF_TOKEN_HEADER_NAME)).toBe('express-token');
        expect(headers.has(LEARNING_OS_CSRF_TOKEN_HEADER_NAME)).toBe(false);
        return { ok: true, status: 204 } as Response;
      });
    vi.stubGlobal('fetch', fetchMock);

    await fetchWithCsrf(`${API_URL}/api/convolab/admin-other/example/mutation`, {
      method: 'POST',
      credentials: 'include',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not bootstrap CSRF for the public tool-audio URL resolver', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response);
    vi.stubGlobal('fetch', fetchMock);

    await fetchWithCsrf('/api/tools-audio/signed-urls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: ['/tools-audio/japanese-time/minute/44.mp3'] }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/tools-audio/signed-urls');
    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.has(CSRF_TOKEN_HEADER_NAME)).toBe(false);
    expect(headers.has(LEARNING_OS_CSRF_TOKEN_HEADER_NAME)).toBe(false);
  });

  it('does not bootstrap CSRF for public browser analytics', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 } as Response);
    vi.stubGlobal('fetch', fetchMock);

    await fetchWithCsrf('/api/convolab/browser/tools/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'japanese:time',
        event: 'answer_passed',
        context: 'public',
      }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.has(CSRF_TOKEN_HEADER_NAME)).toBe(false);
    expect(headers.has(LEARNING_OS_CSRF_TOKEN_HEADER_NAME)).toBe(false);
  });

  it('keeps similarly named tool-audio paths protected by CSRF', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input) === `${API_URL}/api/auth/csrf`) {
          document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=express-token`;
          return { ok: true, status: 204 } as Response;
        }

        const headers = new Headers(init?.headers);
        expect(headers.get(CSRF_TOKEN_HEADER_NAME)).toBe('express-token');
        return { ok: true, status: 404 } as Response;
      });
    vi.stubGlobal('fetch', fetchMock);

    await fetchWithCsrf(`${API_URL}/api/tools-audio/signed-urls-extra`, {
      method: 'POST',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${API_URL}/api/auth/csrf`);
  });

  it('classifies only the exact Episodes namespace as Learning OS', () => {
    expect(getCsrfProviderForPath('/api/convolab/episodes')).toBe('learning-os');
    expect(getCsrfProviderForPath('/api/convolab/episodes/episode-123')).toBe('learning-os');
    expect(getCsrfProviderForPath('/api/convolab/episodes-other')).toBe('express');
  });

  it('classifies only the exact Courses namespace as Learning OS', () => {
    expect(getCsrfProviderForPath('/api/convolab/courses')).toBe('learning-os');
    expect(getCsrfProviderForPath('/api/convolab/courses/course-123/generate')).toBe('learning-os');
    expect(getCsrfProviderForPath('/api/convolab/courses-other')).toBe('express');
  });

  it('classifies only the exact Scripts namespace as Learning OS', () => {
    expect(getCsrfProviderForPath('/api/convolab/scripts')).toBe('learning-os');
    expect(getCsrfProviderForPath('/api/convolab/scripts/episode-123/images')).toBe('learning-os');
    expect(getCsrfProviderForPath('/api/convolab/scripts-other')).toBe('express');
  });

  it.each(['dialogue', 'audio', 'images'])(
    'classifies only the exact %s generation namespace as Learning OS',
    (namespace) => {
      expect(getCsrfProviderForPath(`/api/convolab/${namespace}`)).toBe('learning-os');
      expect(getCsrfProviderForPath(`/api/convolab/${namespace}/job/job-123`)).toBe('learning-os');
      expect(getCsrfProviderForPath(`/api/convolab/${namespace}-other`)).toBe('express');
    }
  );

  it('classifies only the exact Admin namespace as Learning OS', () => {
    expect(getCsrfProviderForPath('/api/convolab/admin')).toBe('learning-os');
    expect(getCsrfProviderForPath('/api/convolab/admin/users/user-123')).toBe('learning-os');
    expect(getCsrfProviderForPath('/api/convolab/admin-other')).toBe('express');
  });

  it('classifies only the exact feature flag path as Learning OS', () => {
    expect(getCsrfProviderForPath('/api/feature-flags')).toBe('learning-os');
    expect(getCsrfProviderForPath('/api/feature-flags/other')).toBe('learning-os');
    expect(getCsrfProviderForPath('/api/feature-flags-other')).toBe('express');
  });

  it('classifies only the direct browser Auth and password namespaces as Learning OS', () => {
    expect(getCsrfProviderForPath('/api/convolab/browser/auth')).toBe('learning-os');
    expect(getCsrfProviderForPath('/api/convolab/browser/auth/login')).toBe('learning-os');
    expect(getCsrfProviderForPath('/api/convolab/browser/auth-other/login')).toBe('express');
    expect(getCsrfProviderForPath('/api/auth/password')).toBe('learning-os');
    expect(getCsrfProviderForPath('/api/auth/password/forgot')).toBe('learning-os');
    expect(getCsrfProviderForPath('/api/auth/password-other/forgot')).toBe('express');
    expect(getCsrfProviderForPath('/api/auth/google')).toBe('express');
  });

  it('classifies only the canonical Study namespace as Learning OS', () => {
    expect(getCsrfProviderForPath('/api/study')).toBe('learning-os');
    expect(getCsrfProviderForPath('/api/study/reviews')).toBe('learning-os');
    expect(getCsrfProviderForPath('/api/study-other/reviews')).toBe('express');
    expect(getCsrfProviderForPath('/api/daily-audio-practice')).toBe('learning-os');
    expect(getCsrfProviderForPath('/api/daily-audio-practice/practice-1')).toBe('learning-os');
    expect(getCsrfProviderForPath('/api/daily-audio-practice-other')).toBe('express');
  });

  it('protects plain password-page fetch calls through the installed Learning OS wrapper', async () => {
    document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=express-token`;
    const originalFetch = vi
      .fn()
      .mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === '/sanctum/csrf-cookie') {
          document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=learning-os-token`;
          return { ok: true, status: 204 } as Response;
        }

        const headers = new Headers(init?.headers);
        expect(headers.get(LEARNING_OS_CSRF_TOKEN_HEADER_NAME)).toBe('learning-os-token');
        expect(headers.has(CSRF_TOKEN_HEADER_NAME)).toBe(false);
        return { ok: true, status: 204 } as Response;
      });
    vi.stubGlobal('fetch', originalFetch);

    installCsrfFetch();
    await fetch('/api/auth/password/forgot', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ada@example.com' }),
    });

    expect(originalFetch.mock.calls.map(([input]) => String(input))).toEqual([
      '/sanctum/csrf-cookie',
      '/api/auth/password/forgot',
    ]);
  });

  it('refreshes the token and retries once when a mutation is rejected for CSRF', async () => {
    document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=stale-token`;
    const fetchMock = vi
      .fn()
      .mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === `${API_URL}/api/auth/csrf`) {
          document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=fresh-token`;
          return {
            ok: true,
            status: 204,
          } as Response;
        }

        const headers = new Headers(init?.headers);
        if (headers.get(CSRF_TOKEN_HEADER_NAME) === 'stale-token') {
          return jsonResponse({ error: { message: 'Invalid CSRF token.' } }, { status: 403 });
        }

        expect(headers.get(CSRF_TOKEN_HEADER_NAME)).toBe('fresh-token');
        return {
          ok: true,
          status: 200,
          json: async () => ({}),
        } as Response;
      });

    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchWithCsrf(`${API_URL}/api/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@example.com', password: 'password123' }),
    });

    expect(response.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${API_URL}/api/auth/login`);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(`${API_URL}/api/auth/csrf`);
    expect(fetchMock.mock.calls[2]?.[0]).toBe(`${API_URL}/api/auth/login`);
  });

  it('does not retry a non-CSRF 403 mutation rejection', async () => {
    document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=valid-token`;
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          error: { message: 'Forbidden' },
        },
        { status: 403 }
      )
    );

    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchWithCsrf(`${API_URL}/api/admin/users`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'user-1' }),
    });

    expect(response.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${API_URL}/api/admin/users`);
  });

  it('does not retry a 403 with a non-JSON body', async () => {
    document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=valid-token`;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('<html>Forbidden</html>', {
        status: 403,
        headers: { 'Content-Type': 'text/html' },
      })
    );

    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchWithCsrf(`${API_URL}/api/admin/users`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'user-1' }),
    });

    expect(response.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${API_URL}/api/admin/users`);
  });

  it('returns the retried rejection when CSRF refresh fails', async () => {
    document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=stale-token`;
    const mutationHeaders: Headers[] = [];
    const fetchMock = vi
      .fn()
      .mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === `${API_URL}/api/auth/csrf`) {
          return {
            ok: false,
            status: 500,
          } as Response;
        }

        const headers = new Headers(init?.headers);
        mutationHeaders.push(headers);

        return jsonResponse({ error: { message: 'Invalid CSRF token.' } }, { status: 403 });
      });

    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchWithCsrf(`${API_URL}/api/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@example.com', password: 'password123' }),
    });

    expect(response.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${API_URL}/api/auth/login`);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(`${API_URL}/api/auth/csrf`);
    expect(fetchMock.mock.calls[2]?.[0]).toBe(`${API_URL}/api/auth/login`);
    expect(mutationHeaders[0]?.get(CSRF_TOKEN_HEADER_NAME)).toBe('stale-token');
    expect(mutationHeaders[1]?.has(CSRF_TOKEN_HEADER_NAME)).toBe(false);
  });

  it('installCsrfFetch wraps window.fetch for unsafe API requests', async () => {
    document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=wrapped-token`;
    const originalFetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input) === '/sanctum/csrf-cookie') {
        document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=learning-os-wrapped-token`;
        return { ok: true, status: 204 } as Response;
      }

      return {
        ok: true,
        json: async () => ({}),
      } as Response;
    });
    vi.stubGlobal('fetch', originalFetch);

    installCsrfFetch();
    await fetch('/api/study/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ limit: 20 }),
    });

    expect(originalFetch).toHaveBeenCalledTimes(2);
    expect(originalFetch.mock.calls[0]?.[0]).toBe('/sanctum/csrf-cookie');
    const headers = new Headers(originalFetch.mock.calls[1]?.[1]?.headers);
    expect(headers.get(LEARNING_OS_CSRF_TOKEN_HEADER_NAME)).toBe('learning-os-wrapped-token');
  });
});
