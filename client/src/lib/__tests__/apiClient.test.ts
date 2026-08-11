import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AUTH_SESSION_EXPIRED_EVENT } from '../authSession';
import { requestJson } from '../apiClient';

const { fetchWithCsrfMock } = vi.hoisted(() => ({
  fetchWithCsrfMock: vi.fn(),
}));

vi.mock('../csrf', () => ({
  fetchWithCsrf: fetchWithCsrfMock,
}));

function response(options: {
  ok: boolean;
  status: number;
  body?: unknown;
  jsonError?: Error;
}): Response {
  return {
    ok: options.ok,
    status: options.status,
    json: vi.fn().mockImplementation(async () => {
      if (options.jsonError) throw options.jsonError;
      return options.body;
    }),
  } as unknown as Response;
}

describe('requestJson', () => {
  beforeEach(() => {
    fetchWithCsrfMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns typed JSON with the canonical session credentials and headers', async () => {
    fetchWithCsrfMock.mockResolvedValue(
      response({ ok: true, status: 200, body: { rows: [{ noteId: 'note-1' }] } })
    );

    await expect(
      requestJson<{ rows: Array<{ noteId: string }> }>('/api/study/browser')
    ).resolves.toEqual({ rows: [{ noteId: 'note-1' }] });

    expect(fetchWithCsrfMock).toHaveBeenCalledWith('/api/study/browser', expect.any(Object));
    const init = fetchWithCsrfMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(init.credentials).toBe('include');
    expect(headers.get('Accept')).toBe('application/json');
    expect(headers.get('Content-Type')).toBeNull();
  });

  it('leaves multipart boundaries to the browser for FormData requests', async () => {
    fetchWithCsrfMock.mockResolvedValue(
      response({ ok: true, status: 200, body: { message: 'Uploaded' } })
    );
    const body = new FormData();
    body.append('image', new File(['image-bytes'], 'avatar.png', { type: 'image/png' }));

    await requestJson('/api/convolab/admin/avatars/speaker/avatar.png/upload', {
      method: 'POST',
      body,
    });

    const init = fetchWithCsrfMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(init.body).toBe(body);
    expect(headers.get('Accept')).toBe('application/json');
    expect(headers.get('Content-Type')).toBeNull();
  });

  it.each([
    [403, { message: 'Browse denied' }, 'Browse denied (403)'],
    [502, { error: { message: 'Learning OS unavailable' } }, 'Learning OS unavailable (502)'],
  ])('preserves structured API error messages', async (status, body, expectedMessage) => {
    fetchWithCsrfMock.mockResolvedValue(response({ ok: false, status, body }));

    await expect(requestJson('/api/study/browser')).rejects.toThrow(expectedMessage);
  });

  it('uses the stable fallback for non-JSON errors', async () => {
    fetchWithCsrfMock.mockResolvedValue(
      response({ ok: false, status: 500, jsonError: new SyntaxError('Unexpected token') })
    );

    await expect(requestJson('/api/study/browser')).rejects.toThrow('Request failed (500)');
  });

  it('notifies the app when the browser session expires', async () => {
    const expiredListener = vi.fn();
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, expiredListener);
    fetchWithCsrfMock.mockResolvedValue(
      response({ ok: false, status: 401, body: { message: 'Unauthorized' } })
    );

    await expect(requestJson('/api/study/browser')).rejects.toThrow('Unauthorized (401)');
    expect(expiredListener).toHaveBeenCalledTimes(1);

    window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, expiredListener);
  });

  it('forwards cancellation and preserves the native abort rejection', async () => {
    const controller = new AbortController();
    fetchWithCsrfMock.mockImplementation(
      async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('The operation was aborted.', 'AbortError')),
            { once: true }
          );
        })
    );

    const pendingRequest = requestJson('/api/study/browser', { signal: controller.signal });
    controller.abort();

    await expect(pendingRequest).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchWithCsrfMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ signal: controller.signal })
    );
  });

  it('returns undefined without parsing a 204 response body', async () => {
    const emptyResponse = response({ ok: true, status: 204 });
    fetchWithCsrfMock.mockResolvedValue(emptyResponse);

    await expect(requestJson<void>('/api/study/cards/card-1', { method: 'DELETE' })).resolves.toBe(
      undefined
    );
    expect(emptyResponse.json).not.toHaveBeenCalled();
  });

  it('supports explicitly accepted empty error statuses', async () => {
    const missingResponse = response({ ok: false, status: 404, body: { message: 'Not found' } });
    fetchWithCsrfMock.mockResolvedValue(missingResponse);

    await expect(
      requestJson<void>(
        '/api/study/card-drafts/draft-1',
        { method: 'DELETE' },
        {
          acceptedEmptyStatuses: [404],
        }
      )
    ).resolves.toBe(undefined);
    expect(missingResponse.json).not.toHaveBeenCalled();
  });
});
