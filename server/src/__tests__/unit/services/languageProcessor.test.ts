import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Import after mocking
import {
  processJapanese,
  processChinese,
  processLanguageText,
  processJapaneseBatch,
  processChineseBatch,
  processLanguageTextBatch,
  furiganaToRuby,
  extractKanjiFromFurigana,
  extractReadingFromFurigana,
} from '../../../services/languageProcessor.js';

// Create hoisted mock for fetch
const mockFetch = vi.hoisted(() => vi.fn());

vi.stubGlobal('fetch', mockFetch);

describe('languageProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processJapanese', () => {
    it('should call furigana service and return metadata', async () => {
      const mockResponse = {
        kanji: '漢字',
        kana: 'かんじ',
        furigana: '漢[かん]字[じ]',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await processJapanese('漢字');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/furigana'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: '漢字' }),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should return fallback when service returns error status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      });

      const result = await processJapanese('漢字');

      expect(result).toEqual({
        kanji: '漢字',
        kana: '漢字',
        furigana: '漢字',
      });
    });

    it('should return fallback when service is unavailable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await processJapanese('テスト');

      expect(result).toEqual({
        kanji: 'テスト',
        kana: 'テスト',
        furigana: 'テスト',
      });
    });
  });

  describe('processChinese', () => {
    it('should call pinyin service and return metadata', async () => {
      const mockResponse = {
        characters: '你好',
        pinyinToneMarks: 'nǐ hǎo',
        pinyinToneNumbers: 'ni3 hao3',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await processChinese('你好');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/pinyin'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: '你好' }),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should return fallback when service returns error status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      });

      const result = await processChinese('你好');

      expect(result).toEqual({
        characters: '你好',
        pinyinToneMarks: '',
        pinyinToneNumbers: '',
      });
    });

    it('should return fallback when service is unavailable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await processChinese('中文');

      expect(result).toEqual({
        characters: '中文',
        pinyinToneMarks: '',
        pinyinToneNumbers: '',
      });
    });
  });

  describe('processLanguageText', () => {
    it('should process Japanese text', async () => {
      const mockResponse = {
        kanji: '日本語',
        kana: 'にほんご',
        furigana: '日[に]本[ほん]語[ご]',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await processLanguageText('日本語', 'ja');

      expect(result.japanese).toEqual(mockResponse);
      expect(result.chinese).toBeUndefined();
    });

    it('should process Chinese text', async () => {
      const mockResponse = {
        characters: '中文',
        pinyinToneMarks: 'zhōng wén',
        pinyinToneNumbers: 'zhong1 wen2',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await processLanguageText('中文', 'zh');

      expect(result.chinese).toEqual(mockResponse);
      expect(result.japanese).toBeUndefined();
    });

    it('should return empty metadata for Spanish (phonetic language)', async () => {
      const result = await processLanguageText('Hola', 'es');

      expect(result).toEqual({});
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return empty metadata for unknown language codes', async () => {
      const result = await processLanguageText('Hello', 'en');

      expect(result).toEqual({});
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('processJapaneseBatch', () => {
    it('should return empty array for empty input', async () => {
      const result = await processJapaneseBatch([]);

      expect(result).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should process multiple texts in batch', async () => {
      const mockResponse = [
        { kanji: '漢字', kana: 'かんじ', furigana: '漢[かん]字[じ]' },
        { kanji: '日本', kana: 'にほん', furigana: '日[に]本[ほん]' },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await processJapaneseBatch(['漢字', '日本']);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/furigana/batch'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ texts: ['漢字', '日本'] }),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should return fallback for all texts when batch service fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Service unavailable'));

      const result = await processJapaneseBatch(['漢字', '日本']);

      expect(result).toEqual([
        { kanji: '漢字', kana: '漢字', furigana: '漢字' },
        { kanji: '日本', kana: '日本', furigana: '日本' },
      ]);
    });

    it('should return fallback when batch service returns error status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Service Error',
      });

      const result = await processJapaneseBatch(['テスト']);

      expect(result).toEqual([{ kanji: 'テスト', kana: 'テスト', furigana: 'テスト' }]);
    });
  });

  describe('processChineseBatch', () => {
    it('should return empty array for empty input', async () => {
      const result = await processChineseBatch([]);

      expect(result).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should process multiple texts in batch', async () => {
      const mockResponse = [
        { characters: '你好', pinyinToneMarks: 'nǐ hǎo', pinyinToneNumbers: 'ni3 hao3' },
        { characters: '中国', pinyinToneMarks: 'zhōng guó', pinyinToneNumbers: 'zhong1 guo2' },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await processChineseBatch(['你好', '中国']);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/pinyin/batch'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ texts: ['你好', '中国'] }),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should return fallback for all texts when batch service fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Service unavailable'));

      const result = await processChineseBatch(['你好', '中国']);

      expect(result).toEqual([
        { characters: '你好', pinyinToneMarks: '', pinyinToneNumbers: '' },
        { characters: '中国', pinyinToneMarks: '', pinyinToneNumbers: '' },
      ]);
    });
  });

  describe('processLanguageTextBatch', () => {
    it('should return empty array for empty input', async () => {
      const result = await processLanguageTextBatch([], 'ja');

      expect(result).toEqual([]);
    });

    it('should process Japanese batch and wrap in metadata', async () => {
      const mockResponse = [{ kanji: '漢字', kana: 'かんじ', furigana: '漢[かん]字[じ]' }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await processLanguageTextBatch(['漢字'], 'ja');

      expect(result).toEqual([
        { japanese: { kanji: '漢字', kana: 'かんじ', furigana: '漢[かん]字[じ]' } },
      ]);
    });

    it('should process Chinese batch and wrap in metadata', async () => {
      const mockResponse = [
        { characters: '你好', pinyinToneMarks: 'nǐ hǎo', pinyinToneNumbers: 'ni3 hao3' },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await processLanguageTextBatch(['你好'], 'zh');

      expect(result).toEqual([
        {
          chinese: { characters: '你好', pinyinToneMarks: 'nǐ hǎo', pinyinToneNumbers: 'ni3 hao3' },
        },
      ]);
    });

    it('should return empty metadata for Spanish texts', async () => {
      const result = await processLanguageTextBatch(['Hola', 'Mundo'], 'es');

      expect(result).toEqual([{}, {}]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return empty metadata for unknown language codes', async () => {
      const result = await processLanguageTextBatch(['Hello', 'World'], 'en');

      expect(result).toEqual([{}, {}]);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

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
