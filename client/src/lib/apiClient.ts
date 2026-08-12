import { notifyAuthSessionExpired } from './authSession';
import { errorMessageFromPayload } from './apiError';
import { fetchWithCsrf } from './csrf';

export interface JsonRequestOptions {
  acceptedEmptyStatuses?: readonly number[];
}

export class JsonRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload: unknown
  ) {
    super(message);
    this.name = 'JsonRequestError';
  }
}

function requestHeaders(init?: RequestInit): Headers {
  const headers = new Headers(init?.headers ?? {});
  const method = (init?.method ?? 'GET').toUpperCase();
  const hasBody = typeof init?.body !== 'undefined' && init.body !== null;
  const hasMultipartBody = typeof FormData !== 'undefined' && init?.body instanceof FormData;

  headers.set('Accept', 'application/json');
  if (
    hasBody &&
    !hasMultipartBody &&
    !headers.has('Content-Type') &&
    method !== 'GET' &&
    method !== 'HEAD'
  ) {
    headers.set('Content-Type', 'application/json');
  }

  return headers;
}

export async function requestJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: JsonRequestOptions = {}
): Promise<T> {
  const response = await fetchWithCsrf(input, {
    ...init,
    credentials: 'include',
    headers: requestHeaders(init),
  });

  notifyAuthSessionExpired(response);
  if (options.acceptedEmptyStatuses?.includes(response.status)) {
    return undefined as T;
  }
  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      // Keep the normalized message when an upstream returned a non-JSON error page.
    }
    const message = errorMessageFromPayload(payload) ?? 'Request failed';
    throw new JsonRequestError(`${message} (${String(response.status)})`, response.status, payload);
  }
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
