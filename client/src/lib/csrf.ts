import { API_URL } from '../config';

export const CSRF_TOKEN_COOKIE_NAME = 'XSRF-TOKEN';
export const CSRF_TOKEN_HEADER_NAME = 'X-CSRF-Token';
export const LEARNING_OS_CSRF_TOKEN_HEADER_NAME = 'X-XSRF-TOKEN';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const CSRF_REJECTION_MESSAGE_PATTERN = /csrf/i;

type CsrfProvider = 'express' | 'learning-os';

const CSRF_PROVIDERS: Record<CsrfProvider, { bootstrapPath: string; headerName: string }> = {
  express: {
    bootstrapPath: '/api/auth/csrf',
    headerName: CSRF_TOKEN_HEADER_NAME,
  },
  'learning-os': {
    bootstrapPath: '/sanctum/csrf-cookie',
    headerName: LEARNING_OS_CSRF_TOKEN_HEADER_NAME,
  },
};

let csrfBootstrap: {
  provider: CsrfProvider;
  promise: Promise<string | null>;
} | null = null;
// Existing Convo Lab pages may receive an Express CSRF cookie from GET /api/auth/me.
// Treat that as the initial owner; direct Learning OS mutations always re-bootstrap.
let activeCsrfProvider: CsrfProvider = 'express';
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

function getCsrfProvider(url: URL): CsrfProvider {
  return url.pathname.startsWith('/api/convolab/') ? 'learning-os' : 'express';
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

  if (Object.values(CSRF_PROVIDERS).some(({ bootstrapPath }) => url.pathname === bootstrapPath)) {
    return false;
  }

  return url.origin === getApiOrigin();
}

async function bootstrapCsrfToken(
  originalFetch: typeof fetch,
  provider: CsrfProvider,
  options: { forceRefresh?: boolean } = {}
): Promise<string | null> {
  const existingToken = readCookieValue(CSRF_TOKEN_COOKIE_NAME);
  if (existingToken && activeCsrfProvider === provider && !options.forceRefresh) {
    return existingToken;
  }

  if (!csrfBootstrap || csrfBootstrap.provider !== provider) {
    const promise = (async () => {
      const response = await originalFetch(`${API_URL}${CSRF_PROVIDERS[provider].bootstrapPath}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        return null;
      }

      const token = readCookieValue(CSRF_TOKEN_COOKIE_NAME);
      if (token) {
        activeCsrfProvider = provider;
      }
      return token;
    })().finally(() => {
      if (csrfBootstrap?.promise === promise) {
        csrfBootstrap = null;
      }
    });
    csrfBootstrap = { provider, promise };
  }

  return csrfBootstrap.promise;
}

export async function getCsrfToken(): Promise<string | null> {
  return bootstrapCsrfToken(globalThis.fetch.bind(globalThis), 'express');
}

async function buildCsrfHeaders(
  originalFetch: typeof fetch,
  input: RequestInfo | URL,
  init?: RequestInit,
  options: { forceRefresh?: boolean } = {}
): Promise<Headers> {
  const url = resolveRequestUrl(input);
  const provider = url ? getCsrfProvider(url) : 'express';
  const providerConfig = CSRF_PROVIDERS[provider];
  const headers = new Headers(
    init?.headers ?? (input instanceof Request ? input.headers : undefined)
  );
  const token = await bootstrapCsrfToken(originalFetch, provider, options);
  const otherProvider = provider === 'express' ? 'learning-os' : 'express';
  headers.delete(CSRF_PROVIDERS[otherProvider].headerName);
  if (token && (options.forceRefresh || !headers.has(providerConfig.headerName))) {
    headers.set(providerConfig.headerName, token);
  }
  // If a forced refresh fails, keep the request flow simple and let the
  // server return the final CSRF rejection instead of fabricating a client error.
  return headers;
}

async function isCsrfRejection(response: Response, provider: CsrfProvider): Promise<boolean> {
  if (provider === 'learning-os' && response.status === 419) {
    return true;
  }
  if (response.status !== 403) {
    return false;
  }

  try {
    const body: unknown = await response.clone().json();
    let message = '';
    if (typeof body === 'object' && body !== null) {
      if ('message' in body && typeof body.message === 'string') {
        message = body.message;
      } else if (
        'error' in body &&
        typeof body.error === 'object' &&
        body.error !== null &&
        'message' in body.error &&
        typeof body.error.message === 'string'
      ) {
        message = body.error.message;
      }
    }

    // Matches the server's CSRF rejection message in server/src/middleware/csrf.ts.
    return CSRF_REJECTION_MESSAGE_PATTERN.test(message);
  } catch {
    return false;
  }
}

async function fetchUnsafeApiWithCsrf(
  originalFetch: typeof fetch,
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const url = resolveRequestUrl(input);
  const provider = url ? getCsrfProvider(url) : 'express';
  const headers = await buildCsrfHeaders(originalFetch, input, init);
  const response = await originalFetch(input, {
    ...init,
    headers,
  });

  if (!(await isCsrfRejection(response, provider))) {
    return response;
  }

  const retryHeaders = await buildCsrfHeaders(originalFetch, input, init, {
    forceRefresh: true,
  });
  // The retry resends init.body, so callers must use replayable body values
  // like strings, Blob, FormData, or URLSearchParams rather than one-shot streams.
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
  csrfBootstrap = null;
  activeCsrfProvider = 'express';
  csrfFetchInstalled = false;
}
