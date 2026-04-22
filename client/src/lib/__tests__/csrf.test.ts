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
