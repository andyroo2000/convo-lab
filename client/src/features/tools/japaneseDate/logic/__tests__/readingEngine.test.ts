import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  generateJapaneseDateTimeReading,
  parseLocalDateTimeInput,
  toLocalDateInputValue,
  toLocalTimeInputValue,
} from '../readingEngine';

describe('readingEngine', () => {
  describe('generateJapaneseDateTimeReading', () => {
    it('uses expected reading for every day of month 1-31', () => {
      const expected = [
        '',
        'ついたち',
        'ふつか',
        'みっか',
        'よっか',
        'いつか',
        'むいか',
        'なのか',
        'ようか',
        'ここのか',
        'とおか',
        'じゅういちにち',
        'じゅうににち',
        'じゅうさんにち',
        'じゅうよっか',
        'じゅうごにち',
        'じゅうろくにち',
        'じゅうしちにち',
        'じゅうはちにち',
        'じゅうくにち',
        'はつか',
        'にじゅういちにち',
        'にじゅうににち',
        'にじゅうさんにち',
        'にじゅうよっか',
        'にじゅうごにち',
        'にじゅうろくにち',
        'にじゅうしちにち',
        'にじゅうはちにち',
        'にじゅうくにち',
        'さんじゅうにち',
        'さんじゅういちにち',
      ];

      for (let day = 1; day <= 31; day += 1) {
        const reading = generateJapaneseDateTimeReading(new Date(2026, 0, day, 9, 0, 0, 0), {
          hourFormat: '12h',
        });

        expect(reading.parts.dayKana).toBe(expected[day]);
      }
    });

    it.each([
      [1, 'ついたち'],
      [2, 'ふつか'],
      [3, 'みっか'],
      [4, 'よっか'],
      [7, 'なのか'],
      [8, 'ようか'],
      [10, 'とおか'],
      [14, 'じゅうよっか'],
      [20, 'はつか'],
      [24, 'にじゅうよっか'],
    ])('uses irregular day reading for %i', (day, expected) => {
      const reading = generateJapaneseDateTimeReading(new Date(2026, 1, day, 9, 0, 0, 0), {
        hourFormat: '12h',
      });

      expect(reading.parts.dayKana).toBe(expected);
    });

    it.each([
      [4, 'しがつ'],
      [7, 'しちがつ'],
      [9, 'くがつ'],
    ])('uses irregular month reading for %i', (month, expected) => {
      const reading = generateJapaneseDateTimeReading(new Date(2026, month - 1, 13, 9, 0, 0, 0), {
        hourFormat: '12h',
      });

      expect(reading.parts.monthKana).toBe(expected);
    });

    it('uses expected year reading with phonetic changes', () => {
      const reading = generateJapaneseDateTimeReading(new Date(1988, 0, 5, 9, 0, 0, 0), {
        hourFormat: '12h',
      });

      expect(reading.parts.yearKana).toBe('せんきゅうひゃくはちじゅうはちねん');
    });

    it('includes period in 12h mode and omits it in 24h mode', () => {
      const reading12h = generateJapaneseDateTimeReading(new Date(2026, 1, 13, 21, 44, 0, 0), {
        hourFormat: '12h',
      });
      const reading24h = generateJapaneseDateTimeReading(new Date(2026, 1, 13, 21, 44, 0, 0), {
        hourFormat: '24h',
      });

      expect(reading12h.parts.periodKana).toBe('ごご');
      expect(reading12h.parts.hourKana).toBe('くじ');
      expect(reading12h.timeKana).toBe('ごご くじ よんじゅうよんぷん');

      expect(reading24h.parts.periodKana).toBeNull();
      expect(reading24h.parts.hourKana).toBe('にじゅういちじ');
      expect(reading24h.timeKana).toBe('にじゅういちじ よんじゅうよんぷん');
    });

    it('handles midnight and noon correctly in 12h mode', () => {
      const midnight = generateJapaneseDateTimeReading(new Date(2026, 1, 13, 0, 0, 0, 0), {
        hourFormat: '12h',
      });
      const noon = generateJapaneseDateTimeReading(new Date(2026, 1, 13, 12, 0, 0, 0), {
        hourFormat: '12h',
      });

      expect(midnight.parts.periodKana).toBe('ごぜん');
      expect(midnight.parts.hourKana).toBe('じゅうにじ');
      expect(noon.parts.periodKana).toBe('ごご');
      expect(noon.parts.hourKana).toBe('じゅうにじ');
    });

    it.each([
      [0, 'れいふん'],
      [1, 'いっぷん'],
      [3, 'さんぷん'],
      [6, 'ろっぷん'],
      [8, 'はっぷん'],
      [10, 'じゅっぷん'],
      [30, 'さんじゅっぷん'],
      [44, 'よんじゅうよんぷん'],
    ])('uses expected minute reading for %i', (minute, expected) => {
      const reading = generateJapaneseDateTimeReading(new Date(2026, 1, 13, 9, minute, 0, 0), {
        hourFormat: '12h',
      });

      expect(reading.parts.minuteKana).toBe(expected);
    });
  });

  describe('date/time input helpers', () => {
    it('formats local date and time values with leading zeros', () => {
      const value = new Date(2026, 1, 3, 4, 5, 0, 0);

      expect(toLocalDateInputValue(value)).toBe('2026-02-03');
      expect(toLocalTimeInputValue(value)).toBe('04:05');
    });

    it('parses local date/time input into a date', () => {
      const parsed = parseLocalDateTimeInput('2026-02-13', '09:44');

      expect(parsed.getFullYear()).toBe(2026);
      expect(parsed.getMonth()).toBe(1);
      expect(parsed.getDate()).toBe(13);
      expect(parsed.getHours()).toBe(9);
      expect(parsed.getMinutes()).toBe(44);
    });

    it('falls back to now when input is invalid', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-13T12:34:56.000Z'));

      const parsed = parseLocalDateTimeInput('bad-date', 'bad-time');
      expect(Number.isNaN(parsed.getTime())).toBe(false);
      expect(parsed.getTime()).toBe(new Date('2026-02-13T12:34:56.000Z').getTime());
    });
  });
});

afterEach(() => {
  vi.useRealTimers();
});
