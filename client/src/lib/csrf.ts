export const CSRF_TOKEN_COOKIE_NAME = 'XSRF-TOKEN';
export const CSRF_TOKEN_HEADER_NAME = 'X-XSRF-TOKEN';

const CSRF_BOOTSTRAP_PATH = '/sanctum/csrf-cookie';
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const CSRF_REJECTION_MESSAGE_PATTERN = /csrf/i;
const PUBLIC_CSRF_EXEMPT_API_PATHS = new Set([
  '/api/convolab/browser/tools/analytics',
  '/api/tools-audio/signed-urls',
]);

let csrfBootstrap: Promise<string | null> | null = null;
let csrfBootstrapped = false;
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
  if (!url || url.origin !== window.location.origin) {
    return false;
  }

  if (!url.pathname.startsWith('/api/')) {
    return false;
  }

  return !PUBLIC_CSRF_EXEMPT_API_PATHS.has(url.pathname);
}

async function bootstrapCsrfToken(
  originalFetch: typeof fetch,
  options: { forceRefresh?: boolean } = {}
): Promise<string | null> {
  const existingToken = readCookieValue(CSRF_TOKEN_COOKIE_NAME);
  if (existingToken && csrfBootstrapped && !options.forceRefresh) {
    return existingToken;
  }

  if (!csrfBootstrap) {
    const promise = originalFetch(CSRF_BOOTSTRAP_PATH, {
      method: 'GET',
      credentials: 'include',
    })
      .then((response) => {
        const token = response.ok ? readCookieValue(CSRF_TOKEN_COOKIE_NAME) : null;
        csrfBootstrapped = token !== null;
        return token;
      })
      .finally(() => {
        if (csrfBootstrap === promise) {
          csrfBootstrap = null;
        }
      });
    csrfBootstrap = promise;
  }

  return csrfBootstrap;
}

export async function getCsrfToken(): Promise<string | null> {
  return bootstrapCsrfToken(globalThis.fetch.bind(globalThis));
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

async function isCsrfRejection(response: Response): Promise<boolean> {
  if (response.status === 419) {
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
  const headers = await buildCsrfHeaders(originalFetch, input, init);
  const response = await originalFetch(input, {
    ...init,
    headers,
  });

  if (!(await isCsrfRejection(response))) {
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
  csrfBootstrapped = false;
  csrfFetchInstalled = false;
}
