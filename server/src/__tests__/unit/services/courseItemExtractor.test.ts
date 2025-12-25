import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import after mocking
import {
  extractCoreItems,
  extractDialogueExchanges,
  extractDialogueExchangesFromSourceText,
  extractVocabularyFromSentence,
  CoreItem,
  DialogueExchange,
} from '../../../services/courseItemExtractor.js';

// Create hoisted mocks
const mockGenerateWithGemini = vi.hoisted(() => vi.fn());

vi.mock('../../../services/geminiClient.js', () => ({
  generateWithGemini: mockGenerateWithGemini,
}));

describe('courseItemExtractor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper to create mock episode with dialogue
  const createMockEpisode = (sentences: any[]) => ({
    id: 'episode-123',
    title: 'Test Episode',
    sourceText: 'Two friends talking about their weekend',
    targetLanguage: 'ja',
    nativeLanguage: 'en',
    status: 'ready',
    dialogue: {
      sentences,
    },
  });

  // Helper to create mock sentence
  const createMockSentence = (id: string, text: string, translation: string, metadata?: any) => ({
    id,
    text,
    translation,
    order: 0,
    metadata: metadata || {},
    speaker: {
      id: 'speaker-1',
      name: '田中',
      voiceId: 'ja-JP-Neural2-B',
    },
  });

  describe('extractCoreItems', () => {
    it('should throw error when episode has no dialogue', async () => {
      const episode = {
        id: 'episode-123',
        title: 'Test',
        targetLanguage: 'ja',
        dialogue: null,
      };

      await expect(extractCoreItems(episode as any))
        .rejects.toThrow('Episode has no dialogue sentences');
    });

    it('should throw error when episode has empty sentences', async () => {
      const episode = createMockEpisode([]);

      await expect(extractCoreItems(episode as any))
        .rejects.toThrow('Episode has no dialogue sentences');
    });

    it('should extract core items from dialogue sentences', async () => {
      const sentences = [
        createMockSentence('s1', 'こんにちは', 'Hello', {
          japanese: { kanji: 'こんにちは', kana: 'こんにちは' },
        }),
        createMockSentence('s2', 'お元気ですか', 'How are you?', {
          japanese: { kanji: 'お元気ですか', kana: 'おげんきですか' },
        }),
      ];
      const episode = createMockEpisode(sentences);

      // Mock batch decomposition response
      mockGenerateWithGemini.mockResolvedValue(JSON.stringify({
        phrases: [
          { phraseIndex: 0, components: [{ textL2: 'こんにちは', translation: 'Hello', order: 0 }] },
          { phraseIndex: 1, components: [{ textL2: 'お元気ですか', translation: 'How are you?', order: 0 }] },
        ],
      }));

      const result = await extractCoreItems(episode as any);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('textL2');
      expect(result[0]).toHaveProperty('translationL1');
      expect(result[0]).toHaveProperty('complexityScore');
    });

    it('should respect minItems parameter', async () => {
      const sentences = Array.from({ length: 20 }, (_, i) =>
        createMockSentence(`s${i}`, `Japanese ${i}`, `English ${i}`)
      );
      const episode = createMockEpisode(sentences);

      // Mock with enough components for all sentences
      mockGenerateWithGemini.mockResolvedValue(JSON.stringify({
        phrases: Array.from({ length: 8 }, (_, i) => ({
          phraseIndex: i,
          components: [{ textL2: `Japanese ${i}`, translation: `English ${i}`, order: 0 }],
        })),
      }));

      const result = await extractCoreItems(episode as any, 8);

      expect(result.length).toBeGreaterThanOrEqual(8);
    });

    it('should extract reading from Japanese metadata', async () => {
      const sentences = [
        createMockSentence('s1', '漢字', 'Kanji', {
          japanese: { kanji: '漢字', kana: 'かんじ' },
        }),
      ];
      const episode = createMockEpisode(sentences);

      mockGenerateWithGemini.mockResolvedValue(JSON.stringify({
        phrases: [
          { phraseIndex: 0, components: [{ textL2: '漢字', reading: 'かんじ', translation: 'Kanji', order: 0 }] },
        ],
      }));

      const result = await extractCoreItems(episode as any);

      expect(result[0].readingL2).toBe('かんじ');
    });

    it('should extract pinyin from Chinese metadata', async () => {
      const sentences = [
        createMockSentence('s1', '你好', 'Hello', {
          chinese: { pinyin: 'nǐ hǎo' },
        }),
      ];
      const episode = {
        ...createMockEpisode(sentences),
        targetLanguage: 'zh',
      };

      mockGenerateWithGemini.mockResolvedValue(JSON.stringify({
        phrases: [
          { phraseIndex: 0, components: [{ textL2: '你好', translation: 'Hello', order: 0 }] },
        ],
      }));

      const result = await extractCoreItems(episode as any);

      expect(result[0].readingL2).toBe('nǐ hǎo');
    });

    it('should include Pimsleur components for longer phrases', async () => {
      const sentences = [
        createMockSentence('s1', '東京に行きたいです', 'I want to go to Tokyo', {
          japanese: { kanji: '東京に行きたいです', kana: 'とうきょうにいきたいです' },
        }),
      ];
      const episode = createMockEpisode(sentences);

      mockGenerateWithGemini.mockResolvedValue(JSON.stringify({
        phrases: [
          {
            phraseIndex: 0,
            components: [
              { textL2: 'です', reading: 'です', translation: 'it is', order: 0 },
              { textL2: '行きたいです', reading: 'いきたいです', translation: 'want to go', order: 1 },
              { textL2: '東京に行きたいです', reading: 'とうきょうにいきたいです', translation: 'want to go to Tokyo', order: 2 },
            ],
          },
        ],
      }));

      const result = await extractCoreItems(episode as any);

      expect(result[0].components).toBeDefined();
      expect(result[0].components?.length).toBe(3);
      expect(result[0].components?.[0].textL2).toBe('です');
    });

    it('should handle batch decomposition failure gracefully', async () => {
      // Create enough sentences to test the fallback behavior
      const sentences = Array.from({ length: 10 }, (_, i) =>
        createMockSentence(`s${i}`, `Japanese ${i}`, `English ${i}`)
      );
      const episode = createMockEpisode(sentences);

      mockGenerateWithGemini.mockRejectedValue(new Error('API error'));

      const result = await extractCoreItems(episode as any, 3, 5);

      // Should still return items with fallback single components
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].components).toBeDefined();
      expect(result[0].components?.length).toBe(1);
    });
  });

  describe('complexity scoring', () => {
    it('should score shorter sentences lower (simpler)', async () => {
      // Create enough sentences to have variety while also ensuring selection
      const sentences = [
        createMockSentence('s1', 'はい', 'Yes'), // Very short - lowest complexity
        createMockSentence('s2', 'いいえ', 'No'), // Very short
        createMockSentence('s3', 'これはとても長い文章で複雑な表現が含まれています', 'This is a very long sentence'),
        createMockSentence('s4', 'もっと長い文章でさらに複雑な内容が含まれていて読むのが難しい', 'Even longer sentence'),
      ];
      const episode = createMockEpisode(sentences);

      mockGenerateWithGemini.mockResolvedValue(JSON.stringify({
        phrases: sentences.map((_, i) => ({
          phraseIndex: i,
          components: [{ textL2: sentences[i].text, translation: sentences[i].translation, order: 0 }],
        })),
      }));

      const result = await extractCoreItems(episode as any, 2, 4);

      // Results should include at least one item
      expect(result.length).toBeGreaterThan(0);

      // If we have multiple items, the first should have lower or equal complexity than later ones
      // Since items are selected across complexity spectrum
      if (result.length > 1) {
        expect(result[0].complexityScore).toBeLessThanOrEqual(result[result.length - 1].complexityScore);
      }
    });

    it('should reduce score for questions (more useful for drilling)', async () => {
      const sentences = [
        createMockSentence('s1', 'お元気ですか？', 'How are you?'),
        createMockSentence('s2', 'お元気です。', 'I am fine.'),
        createMockSentence('s3', 'よろしくお願いします', 'Nice to meet you'),
      ];
      const episode = createMockEpisode(sentences);

      mockGenerateWithGemini.mockResolvedValue(JSON.stringify({
        phrases: sentences.map((_, i) => ({
          phraseIndex: i,
          components: [{ textL2: sentences[i].text, translation: sentences[i].translation, order: 0 }],
        })),
      }));

      const result = await extractCoreItems(episode as any, 1, 3);

      // Result should have items
      expect(result.length).toBeGreaterThan(0);

      // Find items and verify question has lower complexity
      const questionItem = result.find(r => r.textL2.includes('？'));
      const statementItem = result.find(r => r.textL2.includes('。'));

      if (questionItem && statementItem) {
        // Questions get -5 complexity bonus, so should be lower
        expect(questionItem.complexityScore).toBeLessThanOrEqual(statementItem.complexityScore);
      }
    });

    it('should add complexity for kanji characters', async () => {
      const sentences = [
        createMockSentence('s1', 'こんにちは', 'Hello', {
          japanese: { kanji: 'こんにちは', kana: 'こんにちは' },
        }), // All kana
        createMockSentence('s2', '漢字文章です', 'Kanji text', {
          japanese: { kanji: '漢字文章です', kana: 'かんじぶんしょうです' },
        }), // Has kanji
        createMockSentence('s3', 'いいですね', 'That is nice', {
          japanese: { kanji: 'いいですね', kana: 'いいですね' },
        }), // All kana
      ];
      const episode = createMockEpisode(sentences);

      mockGenerateWithGemini.mockResolvedValue(JSON.stringify({
        phrases: sentences.map((_, i) => ({
          phraseIndex: i,
          components: [{ textL2: sentences[i].text, translation: sentences[i].translation, order: 0 }],
        })),
      }));

      const result = await extractCoreItems(episode as any, 1, 3);

      // Result should have items
      expect(result.length).toBeGreaterThan(0);

      // Check that items with kanji have been scored appropriately
      // The kanji item '漢字文章です' has 4 kanji chars, adding +8 to complexity
      const kanjiItem = result.find(r => r.textL2.includes('漢字'));
      const kanaItem = result.find(r => r.textL2 === 'こんにちは');

      if (kanjiItem && kanaItem) {
        expect(kanjiItem.complexityScore).toBeGreaterThan(kanaItem.complexityScore);
      }
    });
  });

  describe('extractDialogueExchanges', () => {
    it('should throw error when episode has no dialogue', async () => {
      const episode = {
        id: 'episode-123',
        targetLanguage: 'ja',
        dialogue: null,
      };

      await expect(extractDialogueExchanges(episode as any))
        .rejects.toThrow('Episode has no dialogue sentences');
    });

    it('should extract dialogue exchanges with vocabulary', async () => {
      const sentences = [
        createMockSentence('s1', 'こんにちは', 'Hello'),
        createMockSentence('s2', 'お元気ですか', 'How are you?'),
      ];
      const episode = createMockEpisode(sentences);

      mockGenerateWithGemini.mockResolvedValue(JSON.stringify({
        exchanges: [
          { sentenceIndex: 0, vocabulary: [{ word: 'こんにちは', translation: 'hello' }] },
          { sentenceIndex: 1, vocabulary: [{ word: '元気', translation: 'well/healthy' }] },
        ],
      }));

      const result = await extractDialogueExchanges(episode as any);

      expect(result.length).toBe(2);
      expect(result[0]).toHaveProperty('textL2');
      expect(result[0]).toHaveProperty('translationL1');
      expect(result[0]).toHaveProperty('vocabularyItems');
    });

    it('should include speaker information', async () => {
      const sentences = [
        createMockSentence('s1', 'こんにちは', 'Hello'),
      ];
      const episode = createMockEpisode(sentences);

      mockGenerateWithGemini.mockResolvedValue(JSON.stringify({
        exchanges: [
          { sentenceIndex: 0, vocabulary: [] },
        ],
      }));

      const result = await extractDialogueExchanges(episode as any);

      expect(result[0].speakerName).toBe('田中');
      expect(result[0].speakerVoiceId).toBe('ja-JP-Neural2-B');
    });

    it('should handle vocabulary extraction failure gracefully', async () => {
      const sentences = [
        createMockSentence('s1', 'こんにちは', 'Hello'),
      ];
      const episode = createMockEpisode(sentences);

      mockGenerateWithGemini.mockRejectedValue(new Error('API error'));

      const result = await extractDialogueExchanges(episode as any);

      // Should return exchanges without vocabulary
      expect(result.length).toBe(1);
      expect(result[0].vocabularyItems).toEqual([]);
    });

    it('should limit exchanges based on target duration', async () => {
      const sentences = Array.from({ length: 100 }, (_, i) =>
        createMockSentence(`s${i}`, `Japanese ${i}`, `English ${i}`)
      );
      const episode = createMockEpisode(sentences);

      mockGenerateWithGemini.mockResolvedValue(JSON.stringify({
        exchanges: Array.from({ length: 26 }, (_, i) => ({
          sentenceIndex: i,
          vocabulary: [],
        })),
      }));

      const result = await extractDialogueExchanges(episode as any, 15); // 15 minute target

      // Should limit to approximately 15 minutes worth of exchanges
      // At ~35 seconds per exchange, 15 minutes = ~25-26 exchanges
      expect(result.length).toBeLessThanOrEqual(30);
    });
  });

  describe('extractDialogueExchangesFromSourceText', () => {
    it('should generate dialogue from source text', async () => {
      mockGenerateWithGemini.mockResolvedValue(JSON.stringify({
        exchanges: [
          {
            order: 0,
            speakerName: 'Kenji',
            relationshipName: 'Your friend',
            textL2: '北海道に行きましたか？',
            translation: 'Did you go to Hokkaido?',
            vocabulary: [
              { word: '北海道', reading: 'ほっかいどう', translation: 'Hokkaido', jlptLevel: 'N4' },
            ],
          },
          {
            order: 1,
            speakerName: 'You',
            relationshipName: 'You',
            textL2: 'はい、行きました！',
            translation: 'Yes, I went!',
            vocabulary: [
              { word: '行きました', reading: 'いきました', translation: 'went', jlptLevel: 'N5' },
            ],
          },
        ],
      }));

      const result = await extractDialogueExchangesFromSourceText(
        'Two friends discussing a trip to Hokkaido',
        'Hokkaido Trip',
        'ja',
        'en',
        15
      );

      expect(result.length).toBe(2);
      expect(result[0].speakerName).toBe('Kenji');
      expect(result[0].textL2).toBe('北海道に行きましたか？');
      expect(result[0].vocabularyItems.length).toBeGreaterThan(0);
    });

    it('should include JLPT level in vocabulary items', async () => {
      mockGenerateWithGemini.mockResolvedValue(JSON.stringify({
        exchanges: [
          {
            order: 0,
            speakerName: 'Kenji',
            relationshipName: 'Friend',
            textL2: 'すごいですね',
            translation: "That's amazing",
            vocabulary: [
              { word: 'すごい', reading: 'すごい', translation: 'amazing', jlptLevel: 'N4' },
            ],
          },
        ],
      }));

      const result = await extractDialogueExchangesFromSourceText(
        'A conversation',
        'Test',
        'ja',
        'en',
        15,
        'N4'
      );

      expect(result[0].vocabularyItems[0].jlptLevel).toBe('N4');
    });

    it('should assign voice IDs to speakers', async () => {
      mockGenerateWithGemini.mockResolvedValue(JSON.stringify({
        exchanges: [
          {
            order: 0,
            speakerName: 'Kenji',
            relationshipName: 'Friend',
            textL2: 'こんにちは',
            translation: 'Hello',
            vocabulary: [],
          },
          {
            order: 1,
            speakerName: 'Yumi',
            relationshipName: 'Colleague',
            textL2: 'こんにちは',
            translation: 'Hello',
            vocabulary: [],
          },
        ],
      }));

      const result = await extractDialogueExchangesFromSourceText(
        'A conversation',
        'Test',
        'ja',
        'en',
        15
      );

      // Each speaker should have a voice ID assigned
      expect(result[0].speakerVoiceId).toBeDefined();
      expect(result[1].speakerVoiceId).toBeDefined();
    });

    it('should use provided speaker voice IDs', async () => {
      mockGenerateWithGemini.mockResolvedValue(JSON.stringify({
        exchanges: [
          {
            order: 0,
            speakerName: 'Speaker1',
            relationshipName: 'Friend',
            textL2: 'テスト',
            translation: 'Test',
            vocabulary: [],
          },
        ],
      }));

      const result = await extractDialogueExchangesFromSourceText(
        'A conversation',
        'Test',
        'ja',
        'en',
        15,
        undefined,
        undefined,
        'male',
        'female',
        'custom-voice-1',
        'custom-voice-2'
      );

      expect(result[0].speakerVoiceId).toBe('custom-voice-1');
    });

    it('should throw error on API failure', async () => {
      mockGenerateWithGemini.mockRejectedValue(new Error('API error'));

      await expect(extractDialogueExchangesFromSourceText(
        'A conversation',
        'Test',
        'ja',
        'en',
        15
      )).rejects.toThrow('Failed to generate dialogue exchanges');
    });

    it('should throw error on invalid response format', async () => {
      mockGenerateWithGemini.mockResolvedValue(JSON.stringify({
        invalid: 'response',
      }));

      await expect(extractDialogueExchangesFromSourceText(
        'A conversation',
        'Test',
        'ja',
        'en',
        15
      )).rejects.toThrow('Invalid response format');
    });

    it('should clean romanization from vocabulary words', async () => {
      mockGenerateWithGemini.mockResolvedValue(JSON.stringify({
        exchanges: [
          {
            order: 0,
            speakerName: 'Kenji',
            relationshipName: 'Friend',
            textL2: 'こんにちは',
            translation: 'Hello',
            vocabulary: [
              { word: 'こんにちは (konnichiwa)', translation: 'hello' },
            ],
          },
        ],
      }));

      const result = await extractDialogueExchangesFromSourceText(
        'A conversation',
        'Test',
        'ja',
        'en',
        15
      );

      // Romanization in parentheses should be removed
      expect(result[0].vocabularyItems[0].textL2).toBe('こんにちは');
    });
  });

  describe('extractVocabularyFromSentence', () => {
    it('should return the sentence as single item (current simple implementation)', () => {
      const result = extractVocabularyFromSentence('こんにちは', 'ja');

      expect(result).toEqual(['こんにちは']);
    });

    it('should work with different languages', () => {
      const jaResult = extractVocabularyFromSentence('テスト', 'ja');
      const zhResult = extractVocabularyFromSentence('测试', 'zh');
      const esResult = extractVocabularyFromSentence('Hola', 'es');

      expect(jaResult).toEqual(['テスト']);
      expect(zhResult).toEqual(['测试']);
      expect(esResult).toEqual(['Hola']);
    });
  });

  describe('JSON parsing with markdown', () => {
    it('should handle JSON wrapped in markdown code blocks', async () => {
      const sentences = Array.from({ length: 10 }, (_, i) =>
        createMockSentence(`s${i}`, `Japanese ${i}`, `English ${i}`)
      );
      const episode = createMockEpisode(sentences);

      // Mock needs to return components for all phrases that will be selected
      mockGenerateWithGemini.mockResolvedValue(`\`\`\`json\n${  JSON.stringify({
        phrases: Array.from({ length: 4 }, (_, i) => ({
          phraseIndex: i,
          components: [{ textL2: `Japanese ${i * 2}`, translation: `English ${i * 2}`, order: 0 }],
        })),
      })  }\n\`\`\``);

      const result = await extractCoreItems(episode as any, 3, 5);

      // Should have extracted items successfully despite markdown wrapping
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('textL2');
      expect(result[0]).toHaveProperty('components');
    });
  });
});
