import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { API_URL } from '../../config';
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

  it('returns the retried rejection when CSRF refresh fails', async () => {
    document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=stale-token`;
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
        if (fetchMock.mock.calls.length === 1) {
          expect(headers.get(CSRF_TOKEN_HEADER_NAME)).toBe('stale-token');
        } else {
          expect(headers.has(CSRF_TOKEN_HEADER_NAME)).toBe(false);
        }

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
  });

  it('installCsrfFetch wraps window.fetch for unsafe API requests', async () => {
    document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=wrapped-token`;
    const originalFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', originalFetch);

    installCsrfFetch();
    await fetch(`${API_URL}/api/study/session/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ limit: 20 }),
    });

    expect(originalFetch).toHaveBeenCalledTimes(1);
    const headers = new Headers(originalFetch.mock.calls[0]?.[1]?.headers);
    expect(headers.get(CSRF_TOKEN_HEADER_NAME)).toBe('wrapped-token');
  });
});
