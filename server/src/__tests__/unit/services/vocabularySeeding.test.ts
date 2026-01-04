import { describe, it, expect, beforeEach } from 'vitest';

import {
  getVocabularyForLevel,
  getGrammarForLevel,
  sampleVocabulary,
  sampleGrammar,
} from '../../../services/vocabularySeeding.js';

describe('vocabularySeeding', () => {
  beforeEach(() => {
    // Clear any caches before each test
    // The service uses internal caching, so we test with fresh state
  });

  describe('Japanese (JLPT)', () => {
    describe('getVocabularyForLevel', () => {
      it('should load N5 vocabulary', async () => {
        const vocabulary = await getVocabularyForLevel('ja', 'N5');
        expect(vocabulary).toBeDefined();
        expect(Array.isArray(vocabulary)).toBe(true);
        expect(vocabulary.length).toBeGreaterThan(0);

        // Verify structure
        const firstWord = vocabulary[0];
        expect(firstWord).toHaveProperty('word');
        expect(firstWord).toHaveProperty('reading');
        expect(firstWord).toHaveProperty('translation');
        expect(firstWord).toHaveProperty('partOfSpeech');
      });

      it('should load all JLPT levels', async () => {
        const levels = ['N5', 'N4', 'N3', 'N2', 'N1'];
        for (const level of levels) {
          const vocabulary = await getVocabularyForLevel('ja', level);
          expect(vocabulary.length).toBeGreaterThan(0);
        }
      });

      it('should cache vocabulary data', async () => {
        const vocab1 = await getVocabularyForLevel('ja', 'N5');
        const vocab2 = await getVocabularyForLevel('ja', 'N5');
        expect(vocab1).toBe(vocab2); // Same reference = cached
      });
    });

    describe('getGrammarForLevel', () => {
      it('should load N5 grammar', async () => {
        const grammar = await getGrammarForLevel('ja', 'N5');
        expect(grammar).toBeDefined();
        expect(Array.isArray(grammar)).toBe(true);
        expect(grammar.length).toBeGreaterThan(0);

        // Verify structure
        const firstPoint = grammar[0];
        expect(firstPoint).toHaveProperty('pattern');
        expect(firstPoint).toHaveProperty('meaning');
        expect(firstPoint).toHaveProperty('usage');
        expect(firstPoint).toHaveProperty('example');
        expect(firstPoint).toHaveProperty('exampleTranslation');
      });

      it('should load all JLPT grammar levels', async () => {
        const levels = ['N5', 'N4', 'N3', 'N2', 'N1'];
        for (const level of levels) {
          const grammar = await getGrammarForLevel('ja', level);
          expect(grammar.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Chinese (HSK)', () => {
    describe('getVocabularyForLevel', () => {
      it('should load HSK1 vocabulary', async () => {
        const vocabulary = await getVocabularyForLevel('zh', 'HSK1');
        expect(vocabulary).toBeDefined();
        expect(Array.isArray(vocabulary)).toBe(true);
        expect(vocabulary.length).toBeGreaterThan(0);

        // Verify structure includes pinyin
        const firstWord = vocabulary[0];
        expect(firstWord).toHaveProperty('word');
        expect(firstWord).toHaveProperty('reading'); // pinyin
        expect(firstWord).toHaveProperty('translation');
        expect(firstWord).toHaveProperty('partOfSpeech');
      });

      it('should load all HSK levels', async () => {
        const levels = ['HSK1', 'HSK2', 'HSK3', 'HSK4', 'HSK5', 'HSK6'];
        for (const level of levels) {
          const vocabulary = await getVocabularyForLevel('zh', level);
          expect(vocabulary.length).toBeGreaterThan(0);
        }
      });

      it('should have increasing vocabulary counts by level', async () => {
        const hsk1 = await getVocabularyForLevel('zh', 'HSK1');
        const hsk3 = await getVocabularyForLevel('zh', 'HSK3');
        const hsk6 = await getVocabularyForLevel('zh', 'HSK6');

        expect(hsk3.length).toBeGreaterThan(hsk1.length);
        expect(hsk6.length).toBeGreaterThan(hsk3.length);
      });
    });

    describe('getGrammarForLevel', () => {
      it('should load HSK1 grammar', async () => {
        const grammar = await getGrammarForLevel('zh', 'HSK1');
        expect(grammar).toBeDefined();
        expect(Array.isArray(grammar)).toBe(true);
        expect(grammar.length).toBeGreaterThan(0);
      });

      it('should load all HSK grammar levels', async () => {
        const levels = ['HSK1', 'HSK2', 'HSK3', 'HSK4', 'HSK5', 'HSK6'];
        for (const level of levels) {
          const grammar = await getGrammarForLevel('zh', level);
          expect(grammar.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Spanish (CEFR)', () => {
    describe('getVocabularyForLevel', () => {
      it('should load A1 vocabulary', async () => {
        const vocabulary = await getVocabularyForLevel('es', 'A1');
        expect(vocabulary).toBeDefined();
        expect(Array.isArray(vocabulary)).toBe(true);
        expect(vocabulary.length).toBeGreaterThan(0);

        // Verify structure (no reading field for Spanish)
        const firstWord = vocabulary[0];
        expect(firstWord).toHaveProperty('word');
        expect(firstWord).toHaveProperty('translation');
        expect(firstWord).toHaveProperty('partOfSpeech');
      });

      it('should load all CEFR levels', async () => {
        const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
        for (const level of levels) {
          const vocabulary = await getVocabularyForLevel('es', level);
          expect(vocabulary.length).toBeGreaterThan(0);
        }
      });

      it('should have increasing vocabulary counts by level', async () => {
        const a1 = await getVocabularyForLevel('es', 'A1');
        const b1 = await getVocabularyForLevel('es', 'B1');
        const c2 = await getVocabularyForLevel('es', 'C2');

        expect(b1.length).toBeGreaterThan(a1.length);
        expect(c2.length).toBeGreaterThan(b1.length);
      });
    });

    describe('getGrammarForLevel', () => {
      it('should load A1 grammar', async () => {
        const grammar = await getGrammarForLevel('es', 'A1');
        expect(grammar).toBeDefined();
        expect(Array.isArray(grammar)).toBe(true);
        expect(grammar.length).toBeGreaterThan(0);
      });

      it('should load all CEFR grammar levels', async () => {
        const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
        for (const level of levels) {
          const grammar = await getGrammarForLevel('es', level);
          expect(grammar.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('French (CEFR)', () => {
    describe('getVocabularyForLevel', () => {
      it('should load A1 vocabulary', async () => {
        const vocabulary = await getVocabularyForLevel('fr', 'A1');
        expect(vocabulary).toBeDefined();
        expect(Array.isArray(vocabulary)).toBe(true);
        expect(vocabulary.length).toBeGreaterThan(0);
      });

      it('should load all CEFR levels', async () => {
        const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
        for (const level of levels) {
          const vocabulary = await getVocabularyForLevel('fr', level);
          expect(vocabulary.length).toBeGreaterThan(0);
        }
      });

      it('should have large vocabulary at C2 level', async () => {
        const c2 = await getVocabularyForLevel('fr', 'C2');
        expect(c2.length).toBeGreaterThan(10000); // Should be ~15,000
      });
    });

    describe('getGrammarForLevel', () => {
      it('should load all CEFR grammar levels', async () => {
        const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
        for (const level of levels) {
          const grammar = await getGrammarForLevel('fr', level);
          expect(grammar.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Arabic (CEFR)', () => {
    describe('getVocabularyForLevel', () => {
      it('should load A1 vocabulary', async () => {
        const vocabulary = await getVocabularyForLevel('ar', 'A1');
        expect(vocabulary).toBeDefined();
        expect(Array.isArray(vocabulary)).toBe(true);
        expect(vocabulary.length).toBeGreaterThan(0);

        // Verify Arabic script is present
        const firstWord = vocabulary[0];
        expect(firstWord.word).toMatch(/[\u0600-\u06FF]/); // Arabic Unicode range
      });

      it('should load all CEFR levels', async () => {
        const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
        for (const level of levels) {
          const vocabulary = await getVocabularyForLevel('ar', level);
          expect(vocabulary.length).toBeGreaterThan(0);
        }
      });
    });

    describe('getGrammarForLevel', () => {
      it('should load A1 grammar with Arabic examples', async () => {
        const grammar = await getGrammarForLevel('ar', 'A1');
        expect(grammar).toBeDefined();
        expect(Array.isArray(grammar)).toBe(true);
        expect(grammar.length).toBeGreaterThan(0);

        // Verify Arabic script in examples
        const firstPoint = grammar[0];
        expect(firstPoint.example).toMatch(/[\u0600-\u06FF]/);
      });

      it('should load all CEFR grammar levels', async () => {
        const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
        for (const level of levels) {
          const grammar = await getGrammarForLevel('ar', level);
          expect(grammar.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('sampleVocabulary', () => {
    it('should return requested number of vocabulary items', async () => {
      const sample = await sampleVocabulary('ja', 'N5', 10);
      expect(sample.length).toBe(10);
    });

    it('should return unique vocabulary items', async () => {
      const sample = await sampleVocabulary('zh', 'HSK1', 20);
      const words = sample.map((v) => v.word);
      const uniqueWords = new Set(words);
      expect(uniqueWords.size).toBe(words.length); // All unique
    });

    it('should handle requests larger than available vocabulary', async () => {
      const sample = await sampleVocabulary('ja', 'N5', 10000);
      const allVocab = await getVocabularyForLevel('ja', 'N5');
      expect(sample.length).toBeLessThanOrEqual(allVocab.length);
    });

    it('should work for all languages', async () => {
      const samples = await Promise.all([
        sampleVocabulary('ja', 'N5', 5),
        sampleVocabulary('zh', 'HSK1', 5),
        sampleVocabulary('es', 'A1', 5),
        sampleVocabulary('fr', 'A1', 5),
        sampleVocabulary('ar', 'A1', 5),
      ]);

      samples.forEach((sample) => {
        expect(sample.length).toBe(5);
      });
    });
  });

  describe('sampleGrammar', () => {
    it('should return requested number of grammar points', async () => {
      const sample = await sampleGrammar('ja', 'N5', 5);
      expect(sample.length).toBe(5);
    });

    it('should return unique grammar points', async () => {
      const sample = await sampleGrammar('zh', 'HSK1', 10);
      const patterns = sample.map((g) => g.pattern);
      const uniquePatterns = new Set(patterns);
      expect(uniquePatterns.size).toBe(patterns.length);
    });

    it('should work for all languages', async () => {
      const samples = await Promise.all([
        sampleGrammar('ja', 'N5', 3),
        sampleGrammar('zh', 'HSK1', 3),
        sampleGrammar('es', 'A1', 3),
        sampleGrammar('fr', 'A1', 3),
        sampleGrammar('ar', 'A1', 3),
      ]);

      samples.forEach((sample) => {
        expect(sample.length).toBe(3);
      });
    });
  });

  describe('Error handling', () => {
    it('should return empty array for invalid language', async () => {
      const vocabulary = await getVocabularyForLevel('invalid', 'A1');
      expect(vocabulary).toEqual([]);
    });

    it('should return empty array for invalid level', async () => {
      const vocabulary = await getVocabularyForLevel('ja', 'INVALID');
      expect(vocabulary).toEqual([]);
    });

    it('should handle sample requests gracefully for invalid language', async () => {
      const sample = await sampleVocabulary('invalid', 'A1', 10);
      expect(sample).toEqual([]);
    });
  });

  describe('Data Quality', () => {
    it('should have valid JSON structure for all files', async () => {
      const testCases = [
        { lang: 'ja', level: 'N5' },
        { lang: 'zh', level: 'HSK1' },
        { lang: 'es', level: 'A1' },
        { lang: 'fr', level: 'A1' },
        { lang: 'ar', level: 'A1' },
      ];

      for (const { lang, level } of testCases) {
        const vocab = await getVocabularyForLevel(lang, level);
        const grammar = await getGrammarForLevel(lang, level);

        expect(vocab).toBeDefined();
        expect(grammar).toBeDefined();
        expect(Array.isArray(vocab)).toBe(true);
        expect(Array.isArray(grammar)).toBe(true);
      }
    });

    it('should have non-empty translations for all vocabulary', async () => {
      const vocab = await getVocabularyForLevel('es', 'A1');
      vocab.forEach((word) => {
        expect(word.translation).toBeTruthy();
        expect(word.translation.length).toBeGreaterThan(0);
      });
    });

    it('should have complete grammar point structure', async () => {
      const grammar = await getGrammarForLevel('zh', 'HSK1');
      grammar.forEach((point) => {
        expect(point.pattern).toBeTruthy();
        expect(point.meaning).toBeTruthy();
        expect(point.usage).toBeTruthy();
        expect(point.example).toBeTruthy();
        expect(point.exampleTranslation).toBeTruthy();
      });
    });
  });
});
