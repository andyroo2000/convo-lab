import { describe, expect, it } from 'vitest';

import { buildDateAudioClipUrls, getDateAudioYearRange } from '../preRenderedDateAudio';

function toManifestDateKey(url: string): string {
  const match = url.match(/\/date\/(year|month|day)\/([0-9]+)\.mp3$/);
  if (!match) {
    throw new Error(`Unexpected date clip URL: ${url}`);
  }

  const [, category, value] = match;
  if (category === 'year') {
    return `year_${value}`;
  }

  return `${category}_${Number.parseInt(value, 10)}`;
}

describe('preRenderedDateAudio', () => {
  it('builds expected clip URLs for a date', () => {
    const urls = buildDateAudioClipUrls({ year: 2026, month: 2, day: 13 });

    expect(urls).toEqual([
      '/tools-audio/japanese-date/google-kento-professional/date/year/2026.mp3',
      '/tools-audio/japanese-date/google-kento-professional/date/month/02.mp3',
      '/tools-audio/japanese-date/google-kento-professional/date/day/13.mp3',
    ]);
  });

  it('maps URLs to expected manifest keys', () => {
    const urls = buildDateAudioClipUrls({ year: 2026, month: 2, day: 13 });
    const keys = urls.map(toManifestDateKey);

    expect(keys).toEqual(['year_2026', 'month_2', 'day_13']);
  });

  it('can omit year clip URLs', () => {
    const urls = buildDateAudioClipUrls({ year: 2026, month: 2, day: 13, includeYear: false });

    expect(urls).toEqual([
      '/tools-audio/japanese-date/google-kento-professional/date/month/02.mp3',
      '/tools-audio/japanese-date/google-kento-professional/date/day/13.mp3',
    ]);
  });

  it('supports inclusive year boundaries', () => {
    expect(buildDateAudioClipUrls({ year: 1900, month: 1, day: 1 })[0]).toContain('/year/1900.mp3');
    expect(buildDateAudioClipUrls({ year: 2100, month: 12, day: 31 })[0]).toContain(
      '/year/2100.mp3'
    );
  });

  it('maps all days of month 1-31 to zero-padded day clips', () => {
    for (let day = 1; day <= 31; day += 1) {
      const urls = buildDateAudioClipUrls({ year: 2026, month: 1, day });
      expect(urls[2]).toBe(
        `/tools-audio/japanese-date/google-kento-professional/date/day/${day
          .toString()
          .padStart(2, '0')}.mp3`
      );
    }
  });

  it('returns supported date audio year range', () => {
    expect(getDateAudioYearRange()).toEqual({ minYear: 1900, maxYear: 2100 });
  });

  it.each([
    [{ year: 1899, month: 1, day: 1 }, 'year must be between 1900 and 2100'],
    [{ year: 2101, month: 1, day: 1 }, 'year must be between 1900 and 2100'],
    [{ year: 2026, month: 0, day: 1 }, 'month must be between 1 and 12'],
    [{ year: 2026, month: 13, day: 1 }, 'month must be between 1 and 12'],
    [{ year: 2026, month: 1, day: 0 }, 'day must be between 1 and 31'],
    [{ year: 2026, month: 1, day: 32 }, 'day must be between 1 and 31'],
  ])('throws for out-of-range args: %o', (args, expectedMessage) => {
    expect(() => buildDateAudioClipUrls(args)).toThrow(expectedMessage);
  });
});
