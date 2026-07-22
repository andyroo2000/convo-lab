import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchLearningOsProxy } from '../../../services/learningOsProxy.js';

const baseRequest = {
  upstreamUrl: new URL('https://learning-os.example/api/test'),
  apiToken: 'proxy-token',
  user: { id: 'user-id', email: 'user@example.com', role: 'admin' },
  method: 'POST',
  timeoutMs: 1_000,
  timeoutMessage: 'Request timed out.',
};

describe('Learning OS proxy transport', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends JSON bodies with the shared identity and content type headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);

    await fetchLearningOsProxy({ ...baseRequest, body: { enabled: true } });

    expect(fetchMock).toHaveBeenCalledWith(
      baseRequest.upstreamUrl,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ enabled: true }),
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer proxy-token',
          'X-Convo-Lab-User-Id': 'user-id',
        }),
      })
    );
  });

  it('passes multipart bodies through without overriding the generated boundary header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    const form = new FormData();
    form.set('cropArea', '{}');

    await fetchLearningOsProxy({ ...baseRequest, rawBody: form });

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(request.body).toBe(form);
    expect(request.headers).toMatchObject({
      Accept: 'application/json',
      Authorization: 'Bearer proxy-token',
      'X-Convo-Lab-User-Id': 'user-id',
    });
    expect(request.headers).not.toHaveProperty('Content-Type');
  });

  it('rejects ambiguous requests containing both JSON and raw bodies', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchLearningOsProxy({
        ...baseRequest,
        body: { enabled: true },
        rawBody: new FormData(),
      })
    ).rejects.toThrow('cannot include both JSON and raw bodies');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
