import { describe, expect, it } from 'vitest';

import { buildTimeAudioClipUrls } from '../preRenderedTimeAudio';

function toManifestTimeKey(url: string): string {
  const twelveHourMatch = url.match(/\/time\/12h\/part1\/(gozen|gogo)-([0-9]{2})\.mp3$/);
  if (twelveHourMatch) {
    const [, period, hour] = twelveHourMatch;
    return `time_12h_part1_${period}_${hour}`;
  }

  const twentyFourHourMatch = url.match(/\/time\/24h\/part1\/([0-9]{2})\.mp3$/);
  if (twentyFourHourMatch) {
    const [, hour] = twentyFourHourMatch;
    return `time_24h_part1_${hour}`;
  }

  const minuteMatch = url.match(/\/time\/minute\/([0-9]{2})\.mp3$/);
  if (minuteMatch) {
    const [, minute] = minuteMatch;
    return `minute_${minute}`;
  }

  throw new Error(`Unexpected time clip URL: ${url}`);
}

describe('preRenderedTimeAudio', () => {
  it('builds expected 12h URLs for AM time', () => {
    const urls = buildTimeAudioClipUrls({ hour24: 9, minute: 44, hourFormat: '12h' });
    expect(urls).toEqual([
      '/tools-audio/japanese-time/google-kento-professional/time/12h/part1/gozen-09.mp3',
      '/tools-audio/japanese-time/google-kento-professional/time/minute/44.mp3',
    ]);
  });

  it('builds expected 12h URLs for PM time', () => {
    const urls = buildTimeAudioClipUrls({ hour24: 21, minute: 44, hourFormat: '12h' });
    expect(urls).toEqual([
      '/tools-audio/japanese-time/google-kento-professional/time/12h/part1/gogo-09.mp3',
      '/tools-audio/japanese-time/google-kento-professional/time/minute/44.mp3',
    ]);
  });

  it('builds expected 24h URLs', () => {
    const urls = buildTimeAudioClipUrls({ hour24: 21, minute: 44, hourFormat: '24h' });
    expect(urls).toEqual([
      '/tools-audio/japanese-time/google-kento-professional/time/24h/part1/21.mp3',
      '/tools-audio/japanese-time/google-kento-professional/time/minute/44.mp3',
    ]);
  });

  it('maps URLs to expected manifest keys', () => {
    const twelveHourKeys = buildTimeAudioClipUrls({
      hour24: 0,
      minute: 0,
      hourFormat: '12h',
    }).map(toManifestTimeKey);
    const twentyFourHourKeys = buildTimeAudioClipUrls({
      hour24: 23,
      minute: 59,
      hourFormat: '24h',
    }).map(toManifestTimeKey);

    expect(twelveHourKeys).toEqual(['time_12h_part1_gozen_12', 'minute_00']);
    expect(twentyFourHourKeys).toEqual(['time_24h_part1_23', 'minute_59']);
  });

  it('handles noon mapping in 12h mode', () => {
    const urls = buildTimeAudioClipUrls({ hour24: 12, minute: 0, hourFormat: '12h' });
    expect(urls[0]).toContain('/time/12h/part1/gogo-12.mp3');
  });

  it.each([
    [{ hour24: -1, minute: 0, hourFormat: '12h' as const }, 'hour24 must be between 0 and 23'],
    [{ hour24: 24, minute: 0, hourFormat: '24h' as const }, 'hour24 must be between 0 and 23'],
    [{ hour24: 9, minute: -1, hourFormat: '12h' as const }, 'minute must be between 0 and 59'],
    [{ hour24: 9, minute: 60, hourFormat: '24h' as const }, 'minute must be between 0 and 59'],
  ])('throws for out-of-range args: %o', (args, expectedMessage) => {
    expect(() => buildTimeAudioClipUrls(args)).toThrow(expectedMessage);
  });
});
