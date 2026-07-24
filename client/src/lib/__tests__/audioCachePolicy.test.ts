import { describe, expect, it } from 'vitest';

import {
  getAudioCachePreloadMode,
  isServiceWorkerAudioRoute,
  normalizeServiceWorkerAudioMessageUrls,
  normalizeWarmableAudioUrls,
} from '../audioCachePolicy';

const APP_ORIGIN = 'https://convo-lab.com';
const signedGcsUrl =
  'https://storage.googleapis.com/convolab-storage/study-media/card/audio.mp3?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Expires=300&X-Goog-Signature=abc';

describe('audioCachePolicy', () => {
  it('excludes authenticated media API URLs from client warming but allows element preloading', () => {
    expect(normalizeWarmableAudioUrls(['/api/convolab/scripts/media/123'], APP_ORIGIN)).toEqual([]);
    expect(normalizeWarmableAudioUrls(['/api/scripts/media/123'], APP_ORIGIN)).toEqual([]);
    expect(
      normalizeWarmableAudioUrls(
        ['/api/learning-os/study/media/01ARZ3NDEKTSV4RRFFQ69G5FAW'],
        APP_ORIGIN
      )
    ).toEqual([]);
    expect(
      normalizeWarmableAudioUrls(
        [
          '/api/learning-os/study/daily-audio-practice/123e4567-e89b-42d3-a456-426614174100/tracks/123e4567-e89b-42d3-a456-426614174101/audio',
        ],
        APP_ORIGIN
      )
    ).toEqual([]);
    expect(
      getAudioCachePreloadMode(
        '/api/learning-os/study/media/01ARZ3NDEKTSV4RRFFQ69G5FAW',
        APP_ORIGIN,
        true
      )
    ).toBe('auto');
    expect(
      getAudioCachePreloadMode(
        '/api/learning-os/study/media/01ARZ3NDEKTSV4RRFFQ69G5FAW',
        APP_ORIGIN,
        false
      )
    ).toBe('metadata');
  });

  it('keeps static same-origin audio URLs warmable', () => {
    expect(
      normalizeWarmableAudioUrls(['/audio/foo.mp3', '/voice-previews/bar.mp3'], APP_ORIGIN)
    ).toEqual([`${APP_ORIGIN}/audio/foo.mp3`, `${APP_ORIGIN}/voice-previews/bar.mp3`]);
    expect(getAudioCachePreloadMode('/audio/foo.mp3', APP_ORIGIN, true)).toBe('auto');
  });

  it('filters signed Google Storage URLs from client and service worker warming', () => {
    expect(normalizeWarmableAudioUrls([signedGcsUrl, '/audio/foo.mp3'], APP_ORIGIN)).toEqual([
      `${APP_ORIGIN}/audio/foo.mp3`,
    ]);
    expect(getAudioCachePreloadMode(signedGcsUrl, APP_ORIGIN, true)).toBe('none');
    expect(normalizeServiceWorkerAudioMessageUrls([signedGcsUrl], APP_ORIGIN)).toEqual([]);
  });

  it('rejects authenticated media redirects in the service worker audio route', () => {
    expect(
      isServiceWorkerAudioRoute({
        request: new Request(`${APP_ORIGIN}/api/convolab/scripts/media/123`),
        url: new URL(`${APP_ORIGIN}/api/convolab/scripts/media/123`),
        sameOrigin: true,
      })
    ).toBe(false);
    expect(
      isServiceWorkerAudioRoute({
        request: new Request(`${APP_ORIGIN}/api/scripts/media/123`),
        url: new URL(`${APP_ORIGIN}/api/scripts/media/123`),
        sameOrigin: true,
      })
    ).toBe(false);
    expect(
      isServiceWorkerAudioRoute({
        request: new Request(
          `${APP_ORIGIN}/api/learning-os/study/media/01ARZ3NDEKTSV4RRFFQ69G5FAW`
        ),
        url: new URL(`${APP_ORIGIN}/api/learning-os/study/media/01ARZ3NDEKTSV4RRFFQ69G5FAW`),
        sameOrigin: true,
      })
    ).toBe(false);
    const dailyAudioUrl =
      `${APP_ORIGIN}/api/learning-os/study/daily-audio-practice/` +
      '123e4567-e89b-42d3-a456-426614174100/tracks/' +
      '123e4567-e89b-42d3-a456-426614174101/audio';
    expect(
      isServiceWorkerAudioRoute({
        request: new Request(dailyAudioUrl),
        url: new URL(dailyAudioUrl),
        sameOrigin: true,
      })
    ).toBe(false);
  });

  it('keeps static audio routes in the service worker audio route', () => {
    expect(
      isServiceWorkerAudioRoute({
        request: new Request(`${APP_ORIGIN}/audio/foo.mp3`),
        url: new URL(`${APP_ORIGIN}/audio/foo.mp3`),
        sameOrigin: true,
      })
    ).toBe(true);
    expect(
      isServiceWorkerAudioRoute({
        request: new Request(`${APP_ORIGIN}/voice-previews/foo.mp3`),
        url: new URL(`${APP_ORIGIN}/voice-previews/foo.mp3`),
        sameOrigin: true,
      })
    ).toBe(true);
  });

  it('normalizes service worker audio messages with study media excluded', () => {
    expect(
      normalizeServiceWorkerAudioMessageUrls(
        [
          '/api/learning-os/study/media/01ARZ3NDEKTSV4RRFFQ69G5FAW',
          '/audio/foo.mp3',
          '/audio/foo.mp3',
        ],
        APP_ORIGIN
      )
    ).toEqual([`${APP_ORIGIN}/audio/foo.mp3`]);
  });

  it('returns no warmable URLs when the base href is malformed', () => {
    expect(normalizeWarmableAudioUrls(['/audio/foo.mp3'], 'not a url')).toEqual([]);
  });
});
