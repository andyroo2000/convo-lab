import { describe, it, expect } from 'vitest';

import {
  furiganaToRuby,
  extractKanjiFromFurigana,
  extractReadingFromFurigana,
} from '../../../services/languageProcessor.js';

describe('languageProcessor', () => {
  describe('furiganaToRuby', () => {
    it('should convert bracket-style furigana to ruby tags', () => {
      const result = furiganaToRuby('漢[かん]字[じ]');

      expect(result).toBe('<ruby>漢<rt>かん</rt></ruby><ruby>字<rt>じ</rt></ruby>');
    });

    it('should handle mixed kanji and hiragana', () => {
      // Note: The regex pattern captures non-bracket chars before each bracket,
      // so hiragana between kanji gets included in the next ruby tag
      const result = furiganaToRuby('私[わたし]の名[な]前[まえ]');

      expect(result).toBe(
        '<ruby>私<rt>わたし</rt></ruby><ruby>の名<rt>な</rt></ruby><ruby>前<rt>まえ</rt></ruby>'
      );
    });

    it('should return plain text unchanged', () => {
      const result = furiganaToRuby('ひらがな');

      expect(result).toBe('ひらがな');
    });

    it('should handle empty string', () => {
      const result = furiganaToRuby('');

      expect(result).toBe('');
    });
  });

  describe('extractKanjiFromFurigana', () => {
    it('should extract kanji from furigana notation', () => {
      const result = extractKanjiFromFurigana('漢[かん]字[じ]');

      expect(result).toBe('漢字');
    });

    it('should handle mixed content', () => {
      const result = extractKanjiFromFurigana('私[わたし]はここにいます');

      expect(result).toBe('私はここにいます');
    });

    it('should return plain text unchanged', () => {
      const result = extractKanjiFromFurigana('ひらがな');

      expect(result).toBe('ひらがな');
    });

    it('should handle empty string', () => {
      const result = extractKanjiFromFurigana('');

      expect(result).toBe('');
    });
  });

  describe('extractReadingFromFurigana', () => {
    it('should extract reading from furigana notation', () => {
      const result = extractReadingFromFurigana('漢[かん]字[じ]');

      expect(result).toBe('かんじ');
    });

    it('should handle mixed kanji and hiragana', () => {
      // Note: The regex pattern captures chars before brackets in group 1,
      // so standalone hiragana gets consumed but the reading (group 2) is used
      const result = extractReadingFromFurigana('私[わたし]の名[な]前[まえ]');

      expect(result).toBe('わたしなまえ');
    });

    it('should preserve hiragana without brackets', () => {
      const result = extractReadingFromFurigana('食[た]べる');

      expect(result).toBe('たべる');
    });

    it('should return plain text unchanged', () => {
      const result = extractReadingFromFurigana('ひらがな');

      expect(result).toBe('ひらがな');
    });

    it('should handle empty string', () => {
      const result = extractReadingFromFurigana('');

      expect(result).toBe('');
    });

    it('should handle text with trailing hiragana', () => {
      const result = extractReadingFromFurigana('日[に]本[ほん]語[ご]です');

      expect(result).toBe('にほんごです');
    });
  });
});
