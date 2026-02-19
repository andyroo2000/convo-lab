import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  resolveToolAudioPlaybackUrls,
  resetToolAudioUrlResolverCacheForTests,
} from '../toolAudioUrlResolver';

describe('toolAudioUrlResolver', () => {
  beforeEach(() => {
    resetToolAudioUrlResolverCacheForTests();
    vi.restoreAllMocks();
  });

  it('returns signed URLs for tool audio paths', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        urls: {
          '/tools-audio/japanese-time/google-kento-professional/time/minute/44.mp3': {
            url: 'https://signed.example/minute-44.mp3',
            expiresAt: '2100-01-01T00:00:00.000Z',
          },
        },
      }),
    } as Response);

    const resolved = await resolveToolAudioPlaybackUrls([
      '/tools-audio/japanese-time/google-kento-professional/time/minute/44.mp3',
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(resolved).toEqual(['https://signed.example/minute-44.mp3']);
  });

  it('uses cache for fresh signed URLs', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        urls: {
          '/tools-audio/japanese-date/google-kento-professional/date/day/13.mp3': {
            url: 'https://signed.example/day-13.mp3',
            expiresAt: '2100-01-01T00:00:00.000Z',
          },
        },
      }),
    } as Response);

    const first = await resolveToolAudioPlaybackUrls([
      '/tools-audio/japanese-date/google-kento-professional/date/day/13.mp3',
    ]);
    const second = await resolveToolAudioPlaybackUrls([
      '/tools-audio/japanese-date/google-kento-professional/date/day/13.mp3',
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toEqual(['https://signed.example/day-13.mp3']);
    expect(second).toEqual(['https://signed.example/day-13.mp3']);
  });

  it('falls back to original URLs when signing request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network down'));

    const originalUrl =
      '/tools-audio/japanese-counters/google-kento-professional/phrase/hon/pencil/06.mp3';
    const resolved = await resolveToolAudioPlaybackUrls([originalUrl]);

    expect(resolved).toEqual([originalUrl]);
  });

  it('uses signed URLs even when they are within the refresh window', async () => {
    const signedUrl = 'https://signed.example/short-lived.mp3';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        urls: {
          '/tools-audio/japanese-counters/google-kento-professional/phrase/hon/pencil/06.mp3': {
            url: signedUrl,
            expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          },
        },
      }),
    } as Response);

    const originalUrl =
      '/tools-audio/japanese-counters/google-kento-professional/phrase/hon/pencil/06.mp3';
    const resolved = await resolveToolAudioPlaybackUrls([originalUrl]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(resolved).toEqual([signedUrl]);
  });

  it('does not call signed-url API for non-tool URLs', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const url = 'https://example.com/audio.mp3';

    const resolved = await resolveToolAudioPlaybackUrls([url]);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(resolved).toEqual([url]);
  });
});
