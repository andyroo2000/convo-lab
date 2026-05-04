import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearAudioCache,
  getAudioPreloadMode,
  isSignedGoogleStorageUrl,
  normalizeAudioCacheUrls,
  shouldPreloadAudioUrl,
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
    vi.useRealTimers();
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
      normalizeAudioCacheUrls(['/audio/1.mp3', '/audio/1.mp3', 'https://cdn.test/a.mp3'])
    ).toEqual([`${window.location.origin}/audio/1.mp3`]);
  });

  it('excludes redirected study media URLs from cache warming but allows element preloading', async () => {
    const postMessage = vi.fn();
    defineNavigatorValue('serviceWorker', {
      controller: { postMessage },
      ready: Promise.resolve({ active: { postMessage } }),
    });

    expect(normalizeAudioCacheUrls(['/api/study/media/1'])).toEqual([]);
    expect(shouldPreloadAudioUrl('/api/study/media/1')).toBe(false);
    expect(getAudioPreloadMode('/api/study/media/1')).toBe('auto');

    await warmAudioCache(['/api/study/media/1']);

    expect(postMessage).not.toHaveBeenCalled();
  });

  it('skips warming when the browser asks to save data', async () => {
    const postMessage = vi.fn();
    defineNavigatorValue('connection', { saveData: true });
    defineNavigatorValue('serviceWorker', {
      controller: { postMessage },
      ready: Promise.resolve({ active: { postMessage } }),
    });

    await warmAudioCache(['/audio/1.mp3']);

    expect(postMessage).not.toHaveBeenCalled();
  });

  it('posts deduped audio URLs to the active service worker', async () => {
    const postMessage = vi.fn();
    defineNavigatorValue('serviceWorker', {
      controller: { postMessage },
      ready: Promise.resolve({ active: { postMessage } }),
    });

    await warmAudioCache(['/audio/1.mp3', '/audio/1.mp3']);

    expect(postMessage).toHaveBeenCalledWith({
      type: 'PRECACHE_AUDIO_URLS',
      urls: [`${window.location.origin}/audio/1.mp3`],
    });
  });

  it('filters signed Google Storage URLs from cache warming', async () => {
    const postMessage = vi.fn();
    defineNavigatorValue('serviceWorker', {
      controller: { postMessage },
      ready: Promise.resolve({ active: { postMessage } }),
    });

    const signedUrl =
      'https://storage.googleapis.com/convolab-storage/study-media/card/audio.mp3?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Expires=300&X-Goog-Signature=abc';

    expect(isSignedGoogleStorageUrl(signedUrl)).toBe(true);
    expect(shouldPreloadAudioUrl(signedUrl)).toBe(false);
    expect(getAudioPreloadMode(signedUrl)).toBe('none');
    expect(normalizeAudioCacheUrls([signedUrl, '/audio/1.mp3'])).toEqual([
      `${window.location.origin}/audio/1.mp3`,
    ]);

    await warmAudioCache([signedUrl]);

    expect(postMessage).not.toHaveBeenCalled();
  });

  it('falls back to credentialed fetch when no service worker is active', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok'));
    globalThis.fetch = fetchMock;
    defineNavigatorValue('serviceWorker', {
      controller: null,
      ready: new Promise(() => {}),
    });

    const warmPromise = warmAudioCache(['/audio/1.mp3']);
    await vi.advanceTimersByTimeAsync(1200);
    await warmPromise;

    expect(fetchMock).toHaveBeenCalledWith(`${window.location.origin}/audio/1.mp3`, {
      cache: 'force-cache',
      credentials: 'include',
    });
  });

  it('filters cross-origin audio URLs from cache warming', async () => {
    const postMessage = vi.fn();
    defineNavigatorValue('serviceWorker', {
      controller: { postMessage },
      ready: Promise.resolve({ active: { postMessage } }),
    });

    expect(normalizeAudioCacheUrls(['https://cdn.test/audio.mp3'])).toEqual([]);

    await warmAudioCache(['https://cdn.test/audio.mp3']);

    expect(postMessage).not.toHaveBeenCalled();
  });

  it('does not fallback-fetch cross-origin audio URLs', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok'));
    globalThis.fetch = fetchMock;
    defineNavigatorValue('serviceWorker', {
      controller: null,
      ready: new Promise(() => {}),
    });

    const warmPromise = warmAudioCache(['https://cdn.test/audio.mp3']);
    await vi.advanceTimersByTimeAsync(1200);
    await warmPromise;

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not fallback-fetch signed Google Storage URLs', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok'));
    globalThis.fetch = fetchMock;
    defineNavigatorValue('serviceWorker', {
      controller: null,
      ready: new Promise(() => {}),
    });

    const signedUrl =
      'https://storage.googleapis.com/convolab-storage/study-media/card/audio.mp3?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Expires=300&X-Goog-Signature=abc';

    const warmPromise = warmAudioCache([signedUrl]);
    await vi.advanceTimersByTimeAsync(1200);
    await warmPromise;

    expect(fetchMock).not.toHaveBeenCalled();
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
