import { describe, it, expect } from 'vitest';

import { extractKanjiFromFurigana } from '../../../services/languageProcessor.js';

describe('languageProcessor', () => {
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
});
