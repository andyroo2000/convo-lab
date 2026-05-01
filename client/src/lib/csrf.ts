import { API_URL } from '../config';

export const CSRF_TOKEN_COOKIE_NAME = 'XSRF-TOKEN';
export const CSRF_TOKEN_HEADER_NAME = 'X-CSRF-Token';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

let csrfBootstrapPromise: Promise<string | null> | null = null;
let csrfFetchInstalled = false;

function readCookieValue(name: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookiePrefix = `${name}=`;
  const match = document.cookie
    .split(';')
    .map((segment) => segment.trim())
    .find((segment) => segment.startsWith(cookiePrefix));

  if (!match) {
    return null;
  }

  return decodeURIComponent(match.slice(cookiePrefix.length));
}

function getApiOrigin(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost';
  }

  if (!API_URL) {
    return window.location.origin;
  }

  return new URL(API_URL, window.location.origin).origin;
}

function resolveRequestUrl(input: RequestInfo | URL): URL | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (input instanceof Request) {
    return new URL(input.url, window.location.origin);
  }

  if (input instanceof URL) {
    return input;
  }

  try {
    return new URL(input, window.location.origin);
  } catch {
    return null;
  }
}

function getRequestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) {
    return init.method.toUpperCase();
  }

  if (input instanceof Request) {
    return input.method.toUpperCase();
  }

  return 'GET';
}

function shouldAttachCsrfToken(input: RequestInfo | URL, init?: RequestInit): boolean {
  const method = getRequestMethod(input, init);
  if (!UNSAFE_METHODS.has(method)) {
    return false;
  }

  const url = resolveRequestUrl(input);
  if (!url) {
    return false;
  }

  if (!url.pathname.startsWith('/api/')) {
    return false;
  }

  if (url.pathname === '/api/auth/csrf') {
    return false;
  }

  return url.origin === getApiOrigin();
}

async function bootstrapCsrfToken(
  originalFetch: typeof fetch,
  options: { forceRefresh?: boolean } = {}
): Promise<string | null> {
  const existingToken = readCookieValue(CSRF_TOKEN_COOKIE_NAME);
  if (existingToken && !options.forceRefresh) {
    return existingToken;
  }

  if (!csrfBootstrapPromise) {
    csrfBootstrapPromise = (async () => {
      const response = await originalFetch(`${API_URL}/api/auth/csrf`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        return null;
      }

      return readCookieValue(CSRF_TOKEN_COOKIE_NAME);
    })().finally(() => {
      csrfBootstrapPromise = null;
    });
  }

  return csrfBootstrapPromise;
}

async function buildCsrfHeaders(
  originalFetch: typeof fetch,
  input: RequestInfo | URL,
  init?: RequestInit,
  options: { forceRefresh?: boolean } = {}
): Promise<Headers> {
  const headers = new Headers(
    init?.headers ?? (input instanceof Request ? input.headers : undefined)
  );
  const token = await bootstrapCsrfToken(originalFetch, options);
  if (token && (options.forceRefresh || !headers.has(CSRF_TOKEN_HEADER_NAME))) {
    headers.set(CSRF_TOKEN_HEADER_NAME, token);
  }
  return headers;
}

async function fetchUnsafeApiWithCsrf(
  originalFetch: typeof fetch,
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const headers = await buildCsrfHeaders(originalFetch, input, init);
  const response = await originalFetch(input, {
    ...init,
    headers,
  });

  if (response.status !== 403) {
    return response;
  }

  const retryHeaders = await buildCsrfHeaders(originalFetch, input, init, {
    forceRefresh: true,
  });
  return originalFetch(input, {
    ...init,
    headers: retryHeaders,
  });
}

export async function fetchWithCsrf(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const activeFetch = globalThis.fetch.bind(globalThis);
  if (!shouldAttachCsrfToken(input, init)) {
    return activeFetch(input, init);
  }

  return fetchUnsafeApiWithCsrf(activeFetch, input, init);
}

export function installCsrfFetch(): void {
  if (csrfFetchInstalled || typeof window === 'undefined') {
    return;
  }

  // This wrapper must be installed during bootstrap before app code starts issuing
  // first-party mutation requests or caching its own fetch reference.
  const originalFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (!shouldAttachCsrfToken(input, init)) {
      return originalFetch(input, init);
    }

    return fetchUnsafeApiWithCsrf(originalFetch, input, init);
  }) as typeof window.fetch;

  csrfFetchInstalled = true;
}

export function resetCsrfStateForTests(): void {
  csrfBootstrapPromise = null;
  csrfFetchInstalled = false;
}
