import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchLearningOsStaticMedia } from '../../../services/learningOsStaticMediaProxy.js';

describe('learningOsStaticMediaProxy', () => {
  const originalEnv = process.env;
  const fetchMock = vi.fn();

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.LEARNING_OS_API_URL = 'https://learning-os.example';
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each([
    undefined,
    'https://user:password@learning-os.example',
    'https://learning-os.example?target=other',
    'https://learning-os.example#fragment',
    'https://learning-os.example/prefix',
  ])('rejects an unsafe or ambiguous API URL: %s', async (configuredUrl) => {
    if (configuredUrl === undefined) {
      delete process.env.LEARNING_OS_API_URL;
    } else {
      process.env.LEARNING_OS_API_URL = configuredUrl;
    }

    await expect(
      fetchLearningOsStaticMedia({
        operation: 'tool-audio',
        body: { paths: ['/tools-audio/japanese/minute/44.mp3'] },
      })
    ).rejects.toMatchObject({
      message: 'Learning OS Static Media API is enabled but not configured.',
      statusCode: 503,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects invalid avatar paths at the proxy boundary', async () => {
    await expect(
      fetchLearningOsStaticMedia({
        operation: 'avatar',
        avatarPath: '//attacker.example/avatar.jpg',
      })
    ).rejects.toMatchObject({
      message: 'Learning OS Static Media API received an invalid avatar path.',
      statusCode: 500,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns a gateway timeout when Learning OS hangs', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_url: URL, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });

    const pendingRequest = fetchLearningOsStaticMedia({
      operation: 'tool-audio',
      body: { paths: ['/tools-audio/japanese/minute/44.mp3'] },
    });
    const expectedTimeout = expect(pendingRequest).rejects.toMatchObject({
      message: 'Learning OS Static Media API request timed out.',
      statusCode: 504,
    });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    await vi.advanceTimersByTimeAsync(10_000);

    await expectedTimeout;
  });
});
