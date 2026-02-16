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

  describe('sampleVocabulary', () => {
    it('should return requested number of vocabulary items', async () => {
      const sample = await sampleVocabulary('ja', 'N5', 10);
      expect(sample.length).toBe(10);
    });

    it('should return unique vocabulary items', async () => {
      const sample = await sampleVocabulary('ja', 'N5', 20);
      const words = sample.map((v) => v.word);
      const uniqueWords = new Set(words);
      expect(uniqueWords.size).toBe(words.length); // All unique
    });

    it('should handle requests larger than available vocabulary', async () => {
      const sample = await sampleVocabulary('ja', 'N5', 10000);
      const allVocab = await getVocabularyForLevel('ja', 'N5');
      expect(sample.length).toBeLessThanOrEqual(allVocab.length);
    });

    it('should work for all JLPT levels', async () => {
      const samples = await Promise.all([
        sampleVocabulary('ja', 'N5', 5),
        sampleVocabulary('ja', 'N4', 5),
        sampleVocabulary('ja', 'N3', 5),
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
      const sample = await sampleGrammar('ja', 'N5', 10);
      const patterns = sample.map((g) => g.pattern);
      const uniquePatterns = new Set(patterns);
      expect(uniquePatterns.size).toBe(patterns.length);
    });

    it('should work for all JLPT levels', async () => {
      const samples = await Promise.all([
        sampleGrammar('ja', 'N5', 3),
        sampleGrammar('ja', 'N4', 3),
        sampleGrammar('ja', 'N3', 3),
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
        { lang: 'ja', level: 'N4' },
        { lang: 'ja', level: 'N3' },
        { lang: 'ja', level: 'N2' },
        { lang: 'ja', level: 'N1' },
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
      const vocab = await getVocabularyForLevel('ja', 'N5');
      vocab.forEach((word) => {
        expect(word.translation).toBeTruthy();
        expect(word.translation.length).toBeGreaterThan(0);
      });
    });

    it('should have complete grammar point structure', async () => {
      const grammar = await getGrammarForLevel('ja', 'N5');
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
