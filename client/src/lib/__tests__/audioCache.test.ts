import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearAudioCache,
  normalizeAudioCacheUrls,
  shouldWarmAudioCache,
  warmAudioCache,
} from '../audioCache';
import { defineNavigatorValue } from '../../test/utils';

describe('audioCache', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    defineNavigatorValue('connection', undefined);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    defineNavigatorValue('serviceWorker', {
      controller: {
        postMessage: () => {},
      },
      ready: Promise.resolve({
        active: {
          postMessage: () => {},
        },
      }),
    });
  });

  it('normalizes and dedupes audio URLs', () => {
    expect(
      normalizeAudioCacheUrls([
        '/api/study/media/1',
        '/api/study/media/1',
        'https://cdn.test/a.mp3',
      ])
    ).toEqual([`${window.location.origin}/api/study/media/1`, 'https://cdn.test/a.mp3']);
  });

  it('skips warming when the browser asks to save data', async () => {
    const postMessage = vi.fn();
    defineNavigatorValue('connection', { saveData: true });
    defineNavigatorValue('serviceWorker', {
      controller: { postMessage },
      ready: Promise.resolve({ active: { postMessage } }),
    });

    await warmAudioCache(['/api/study/media/1']);

    expect(postMessage).not.toHaveBeenCalled();
  });

  it('posts deduped audio URLs to the active service worker', async () => {
    const postMessage = vi.fn();
    defineNavigatorValue('serviceWorker', {
      controller: { postMessage },
      ready: Promise.resolve({ active: { postMessage } }),
    });

    await warmAudioCache(['/api/study/media/1', '/api/study/media/1']);

    expect(postMessage).toHaveBeenCalledWith({
      type: 'PRECACHE_AUDIO_URLS',
      urls: [`${window.location.origin}/api/study/media/1`],
    });
  });

  it('falls back to credentialed fetch when no service worker is active', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok'));
    globalThis.fetch = fetchMock;
    defineNavigatorValue('serviceWorker', {
      controller: null,
      ready: new Promise(() => {}),
    });

    await warmAudioCache(['/api/study/media/1']);

    expect(fetchMock).toHaveBeenCalledWith(`${window.location.origin}/api/study/media/1`, {
      cache: 'force-cache',
      credentials: 'include',
    });
  });

  it('detects constrained network conditions', () => {
    defineNavigatorValue('connection', { effectiveType: '2g' });
    expect(shouldWarmAudioCache()).toBe(false);

    defineNavigatorValue('connection', { effectiveType: '4g' });
    expect(shouldWarmAudioCache()).toBe(true);
  });

  it('clears the runtime audio cache', async () => {
    const postMessage = vi.fn();
    const deleteCache = vi.fn().mockResolvedValue(true);
    defineNavigatorValue('serviceWorker', {
      controller: { postMessage },
      ready: Promise.resolve({ active: { postMessage } }),
    });
    Object.defineProperty(globalThis, 'caches', {
      configurable: true,
      value: { delete: deleteCache },
    });

    await clearAudioCache();

    expect(postMessage).toHaveBeenCalledWith({ type: 'CLEAR_AUDIO_CACHE' });
    expect(deleteCache).toHaveBeenCalledWith('audio-cache');
  });
});
