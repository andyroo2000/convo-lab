import { beforeEach, describe, expect, it, vi } from 'vitest';

import { playAudioClipSequence } from '../../../logic/audioClipPlayback';
import { buildMoneyAudioClipUrls, playMoneyAudioClipSequence } from '../preRenderedMoneyAudio';

vi.mock('../../../logic/audioClipPlayback', () => ({
  playAudioClipSequence: vi.fn(() => ({
    stop: vi.fn(),
    finished: Promise.resolve(),
    setVolume: vi.fn(),
  })),
}));

describe('preRenderedMoneyAudio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds expected clip URLs for a small amount', () => {
    expect(buildMoneyAudioClipUrls(747)).toEqual([
      '/tools-audio/japanese-money/google-kento-professional/money/chunk/0747.mp3',
    ]);
  });

  it.each([
    [999, ['0999']],
    [1000, ['1000']],
    [9999, ['9999']],
    [10000, ['man-chunk/0001']],
    [100000000, ['oku-chunk/0001']],
  ])('builds expected boundary clip URLs for %i', (amount, expectedParts) => {
    const urls = buildMoneyAudioClipUrls(amount);
    const compact = urls.map((url) =>
      url
        .replace(
          '/tools-audio/japanese-money/google-kento-professional/money/oku-chunk/',
          'oku-chunk/'
        )
        .replace(
          '/tools-audio/japanese-money/google-kento-professional/money/man-chunk/',
          'man-chunk/'
        )
        .replace('/tools-audio/japanese-money/google-kento-professional/money/chunk/', '')
        .replace('/tools-audio/japanese-money/google-kento-professional/money/unit/', '')
        .replace('.mp3', '')
    );

    expect(compact).toEqual(expectedParts);
  });

  it('builds expected multi-segment clips for a large mixed amount', () => {
    expect(buildMoneyAudioClipUrls(1_234_567_890)).toEqual([
      '/tools-audio/japanese-money/google-kento-professional/money/oku-chunk/0012.mp3',
      '/tools-audio/japanese-money/google-kento-professional/money/man-chunk/3456.mp3',
      '/tools-audio/japanese-money/google-kento-professional/money/chunk/7890.mp3',
    ]);
  });

  it('handles zero defensively', () => {
    expect(buildMoneyAudioClipUrls(0)).toEqual([
      '/tools-audio/japanese-money/google-kento-professional/money/chunk/0000.mp3',
    ]);
  });

  it.each([
    [Number.NaN, 'amount must be a finite number'],
    [-1, 'amount must be greater than or equal to 0'],
    [10_000_000_000_000, 'amount must be less than or equal to 9999999999999'],
  ])('throws for invalid amount %p', (amount, expectedMessage) => {
    expect(() => buildMoneyAudioClipUrls(amount)).toThrow(expectedMessage);
  });

  it('plays money clip sequences via shared audio playback helper', () => {
    const urls = ['/tools-audio/japanese-money/google-kento-professional/money/chunk/0747.mp3'];

    playMoneyAudioClipSequence(urls, { volume: 0.35 });

    expect(playAudioClipSequence).toHaveBeenCalledWith(urls, {
      volume: 0.35,
      clipTrimEndMs: 90,
    });
  });
});
