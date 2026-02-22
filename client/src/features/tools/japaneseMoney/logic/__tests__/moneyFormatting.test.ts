import { describe, expect, it } from 'vitest';

import { buildMoneyReading, formatYenAmount } from '../moneyFormatting';

describe('moneyFormatting', () => {
  describe('formatYenAmount', () => {
    it('formats yen using ja-JP grouping with yen symbol prefix', () => {
      expect(formatYenAmount(1234567)).toBe('¥1,234,567');
      expect(formatYenAmount(100)).toBe('¥100');
    });

    it('sanitizes invalid and negative values', () => {
      expect(formatYenAmount(-1)).toBe('¥0');
      expect(formatYenAmount(Number.NaN)).toBe('¥0');
    });
  });

  describe('buildMoneyReading', () => {
    it('returns irregular phonetic readings for hundreds and thousands', () => {
      expect(buildMoneyReading(300).kana).toBe('さんびゃくえん');
      expect(buildMoneyReading(600).kana).toBe('ろっぴゃくえん');
      expect(buildMoneyReading(800).kana).toBe('はっぴゃくえん');
      expect(buildMoneyReading(3000).kana).toBe('さんぜんえん');
      expect(buildMoneyReading(8000).kana).toBe('はっせんえん');
    });

    it('handles large units up to oku and joins kana correctly', () => {
      const reading = buildMoneyReading(1234567890);

      expect(reading.kana).toBe('じゅうにおくさんぜんよんひゃくごじゅうろくまんななせんはっぴゃくきゅうじゅうえん');
      expect(reading.segments).toEqual([
        {
          digits: '12',
          digitsReading: 'じゅうに',
          unitScript: '億',
          unitKana: 'おく',
        },
        {
          digits: '3456',
          digitsReading: 'さんぜんよんひゃくごじゅうろく',
          unitScript: '万',
          unitKana: 'まん',
        },
        {
          digits: '7890',
          digitsReading: 'ななせんはっぴゃくきゅうじゅう',
          unitScript: '',
          unitKana: '',
        },
      ]);
    });

    it('handles zero explicitly', () => {
      const reading = buildMoneyReading(0);
      expect(reading.kana).toBe('れいえん');
      expect(reading.segments[0]?.digits).toBe('0');
      expect(reading.segments[0]?.digitsReading).toBe('れい');
    });
  });
});
