import { notifyAuthSessionExpired } from './authSession';
import readApiError from './apiError';
import { fetchWithCsrf } from './csrf';

export interface JsonRequestOptions {
  acceptedEmptyStatuses?: readonly number[];
}

function requestHeaders(init?: RequestInit): Headers {
  const headers = new Headers(init?.headers ?? {});
  const method = (init?.method ?? 'GET').toUpperCase();
  const hasBody = typeof init?.body !== 'undefined' && init.body !== null;

  headers.set('Accept', 'application/json');
  if (hasBody && !headers.has('Content-Type') && method !== 'GET' && method !== 'HEAD') {
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
    const message = await readApiError(response, 'Request failed');
    throw new Error(`${message} (${String(response.status)})`);
  }
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
