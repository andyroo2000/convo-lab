import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import after mocking
import { generateConversationalLessonScript } from '../../../services/conversationalLessonScriptGenerator.js';
import type { DialogueExchange, VocabularyItem } from '../../../services/courseItemExtractor.js';

// Hoisted mock
const mockGenerateWithGemini = vi.hoisted(() => vi.fn());

// Mock dependencies
vi.mock('../../../services/geminiClient.js', () => ({
  generateWithGemini: mockGenerateWithGemini,
}));

describe('conversationalLessonScriptGenerator', () => {
  const mockContext = {
    episodeTitle: 'At a Japanese Bar',
    targetLanguage: 'ja',
    nativeLanguage: 'en',
    l1VoiceId: 'en-US-Neural2-D',
    l2VoiceIds: {
      田中: 'ja-JP-Neural2-B',
      山田: 'ja-JP-Neural2-C',
    },
    jlptLevel: 'N4',
  };

  const mockVocabItem: VocabularyItem = {
    textL2: '行きました',
    readingL2: 'いきました',
    translationL1: 'went',
    jlptLevel: 'N5',
  };

  const mockExchanges: DialogueExchange[] = [
    {
      order: 0,
      speakerName: '田中',
      relationshipName: 'The bartender',
      speakerVoiceId: 'ja-JP-Neural2-B',
      textL2: 'どこに行きましたか',
      readingL2: 'どこにいきましたか',
      translationL1: 'Where did you go?',
      vocabularyItems: [mockVocabItem],
    },
    {
      order: 1,
      speakerName: 'You',
      relationshipName: 'You',
      speakerVoiceId: 'ja-JP-Neural2-C',
      textL2: '北海道に行きました',
      readingL2: 'ほっかいどうにいきました',
      translationL1: 'I went to Hokkaido',
      vocabularyItems: [
        { textL2: '北海道', readingL2: 'ほっかいどう', translationL1: 'Hokkaido', jlptLevel: 'N4' },
      ],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Default scenario response
    mockGenerateWithGemini.mockResolvedValue(
      'Pretend you are an American traveler at a Japanese bar in Hokkaido.'
    );
  });

  describe('generateConversationalLessonScript', () => {
    it('should generate intro with AI-generated scenario', async () => {
      const result = await generateConversationalLessonScript(mockExchanges, mockContext);

      expect(mockGenerateWithGemini).toHaveBeenCalled();
      const scenarioUnit = result.units.find(
        (u) => u.type === 'narration_L1' && u.text.includes('Pretend')
      );
      expect(scenarioUnit).toBeDefined();
    });

    it('should include JLPT level in scenario prompt when provided', async () => {
      await generateConversationalLessonScript(mockExchanges, mockContext);

      const call = mockGenerateWithGemini.mock.calls[0][0];
      expect(call).toContain('JLPT N4');
    });

    it('should use fallback intro when AI fails', async () => {
      mockGenerateWithGemini.mockRejectedValue(new Error('AI error'));

      const result = await generateConversationalLessonScript(mockExchanges, mockContext);

      const fallbackUnit = result.units.find(
        (u) => u.type === 'narration_L1' && u.text.includes('Welcome to this lesson')
      );
      expect(fallbackUnit).toBeDefined();
    });

    it('should include lesson start and end markers', async () => {
      const result = await generateConversationalLessonScript(mockExchanges, mockContext);

      const markers = result.units.filter((u) => u.type === 'marker');
      expect(markers.length).toBeGreaterThanOrEqual(2);
      expect(markers.some((m) => m.label === 'Lesson Start')).toBe(true);
      expect(markers.some((m) => m.label === 'Lesson End')).toBe(true);
    });

    it('should include outro narration', async () => {
      const result = await generateConversationalLessonScript(mockExchanges, mockContext);

      const outroUnit = result.units.find(
        (u) => u.type === 'narration_L1' && u.text.includes('Great work')
      );
      expect(outroUnit).toBeDefined();
    });

    it('should return estimated duration', async () => {
      const result = await generateConversationalLessonScript(mockExchanges, mockContext);

      expect(result.estimatedDurationSeconds).toBeGreaterThan(0);
    });

    it('should process odd-indexed exchanges as user responses', async () => {
      // Exchange at index 1 is the user response
      const result = await generateConversationalLessonScript(mockExchanges, mockContext);

      // User responses should have "You respond:" narration
      const respondUnit = result.units.find(
        (u) => u.type === 'narration_L1' && u.text.includes('You respond')
      );
      expect(respondUnit).toBeDefined();
    });

    it('should process even-indexed exchanges as questions from other person', async () => {
      // Exchange at index 0 is from the other person
      const result = await generateConversationalLessonScript(mockExchanges, mockContext);

      // Should have "says:" narration for other person
      const saysUnit = result.units.find(
        (u) => u.type === 'narration_L1' && u.text.includes('says:')
      );
      expect(saysUnit).toBeDefined();
    });

    it('should include L2 units for dialogue', async () => {
      const result = await generateConversationalLessonScript(mockExchanges, mockContext);

      const l2Units = result.units.filter((u) => u.type === 'L2');
      expect(l2Units.length).toBeGreaterThan(0);
    });

    it('should include pause units', async () => {
      const result = await generateConversationalLessonScript(mockExchanges, mockContext);

      const pauseUnits = result.units.filter((u) => u.type === 'pause');
      expect(pauseUnits.length).toBeGreaterThan(0);
    });

    it('should use correct voice IDs for L1 and L2', async () => {
      const result = await generateConversationalLessonScript(mockExchanges, mockContext);

      // Check L1 (narration) uses English voice
      const l1Units = result.units.filter((u) => u.type === 'narration_L1');
      l1Units.forEach((unit) => {
        expect(unit.voiceId).toBe('en-US-Neural2-D');
      });

      // Check L2 uses Japanese voice
      const l2Units = result.units.filter((u) => u.type === 'L2');
      l2Units.forEach((unit) => {
        expect(['ja-JP-Neural2-B', 'ja-JP-Neural2-C']).toContain(unit.voiceId);
      });
    });

    it('should include translation in question units', async () => {
      const result = await generateConversationalLessonScript(mockExchanges, mockContext);

      // Question translation should be provided
      const translationUnit = result.units.find(
        (u) => u.type === 'narration_L1' && u.text.includes('That means:')
      );
      expect(translationUnit).toBeDefined();
    });

    it('should teach vocabulary items', async () => {
      // Use context without JLPT level so vocab isn't filtered
      const contextNoJlpt = { ...mockContext, jlptLevel: undefined };
      const result = await generateConversationalLessonScript(mockExchanges, contextNoJlpt);

      // Should have vocabulary introduction - looking for "Here's how you say" pattern
      const vocabIntroUnit = result.units.find(
        (u) => u.type === 'narration_L1' && u.text.includes("Here's how you say")
      );
      expect(vocabIntroUnit).toBeDefined();
    });

    it('should skip vocabulary already introduced in lesson', async () => {
      // Create exchanges where same vocab appears twice
      const duplicateVocab: VocabularyItem = {
        textL2: '行きました',
        translationL1: 'went',
        jlptLevel: 'N5',
      };

      const exchangesWithDuplicates: DialogueExchange[] = [
        {
          order: 0,
          speakerName: 'Other',
          relationshipName: 'Friend',
          speakerVoiceId: 'ja-JP-Neural2-B',
          textL2: '昨日どこに行きましたか',
          readingL2: null,
          translationL1: 'Where did you go yesterday?',
          vocabularyItems: [duplicateVocab],
        },
        {
          order: 1,
          speakerName: 'You',
          relationshipName: 'You',
          speakerVoiceId: 'ja-JP-Neural2-C',
          textL2: '東京に行きました',
          readingL2: null,
          translationL1: 'I went to Tokyo',
          vocabularyItems: [duplicateVocab], // Same vocab - should be skipped
        },
      ];

      const result = await generateConversationalLessonScript(exchangesWithDuplicates, mockContext);

      // Count how many times 行きました is taught
      const vocabL2Units = result.units.filter((u) => u.type === 'L2' && u.text === '行きました');
      // Should only be taught once (first exchange teaches it, second skips)
      expect(vocabL2Units.length).toBeLessThanOrEqual(2); // At most 2 repetitions from first teaching
    });

    it('should include all L2 units at normal speed', async () => {
      const result = await generateConversationalLessonScript(mockExchanges, mockContext);

      const l2Units = result.units.filter((u) => u.type === 'L2');
      const speeds = l2Units.map((u) => u.speed);

      // L2 units should be at normal speed (1.0) or question-prompt speed (0.75)
      expect(speeds.every((s) => s === 1.0 || s === 0.75 || s === undefined)).toBe(true);
    });

    it('should work with empty exchanges', async () => {
      const result = await generateConversationalLessonScript([], mockContext);

      expect(result.units.length).toBeGreaterThan(0); // Still has intro/outro
      expect(result.estimatedDurationSeconds).toBeGreaterThan(0);
    });

    it('should normalize narrator text with slashes', async () => {
      const exchangeWithSlash: DialogueExchange[] = [
        {
          order: 0,
          speakerName: 'Other',
          relationshipName: 'Friend',
          speakerVoiceId: 'ja-JP-Neural2-B',
          textL2: 'テスト',
          readingL2: null,
          translationL1: 'at/in the store',
          vocabularyItems: [],
        },
      ];

      const result = await generateConversationalLessonScript(exchangeWithSlash, mockContext);

      // The slash should be replaced with " or "
      const narratorUnits = result.units.filter((u) => u.type === 'narration_L1');
      const hasSlash = narratorUnits.some((u) => u.text.includes('/'));
      expect(hasSlash).toBe(false);
    });

    it('should generate progressive phrase chunks for responses', async () => {
      // Use exchanges with vocabulary that won't be filtered (N3+ for N4 learner)
      const exchangesForChunks: DialogueExchange[] = [
        {
          order: 0,
          speakerName: 'Other',
          relationshipName: 'Friend',
          speakerVoiceId: 'ja-JP-Neural2-B',
          textL2: 'どうでしたか',
          readingL2: null,
          translationL1: 'How was it?',
          vocabularyItems: [],
        },
        {
          order: 1,
          speakerName: 'You',
          relationshipName: 'You',
          speakerVoiceId: 'ja-JP-Neural2-C',
          textL2: '楽しかったです',
          readingL2: null,
          translationL1: 'It was fun',
          vocabularyItems: [
            { textL2: '楽しい', translationL1: 'fun', jlptLevel: 'N3' },
            { textL2: 'です', translationL1: 'is/was', jlptLevel: 'N3' },
          ],
        },
      ];

      // Mock Gemini to return progressive chunks
      mockGenerateWithGemini
        .mockResolvedValueOnce('Pretend you are talking to a friend.')
        .mockResolvedValueOnce(
          JSON.stringify([
            { phrase: '楽しい', translation: 'fun' },
            { phrase: '楽しかった', translation: 'was fun' },
          ])
        );

      await generateConversationalLessonScript(exchangesForChunks, mockContext);

      // Should have called Gemini for scenario + progressive chunks
      expect(mockGenerateWithGemini).toHaveBeenCalledTimes(2);
    });

    it('should handle vocabulary without JLPT level', async () => {
      const exchangeNoJlpt: DialogueExchange[] = [
        {
          order: 0,
          speakerName: 'Other',
          relationshipName: 'Friend',
          speakerVoiceId: 'ja-JP-Neural2-B',
          textL2: 'テスト',
          readingL2: null,
          translationL1: 'Test',
          vocabularyItems: [
            { textL2: 'テスト', translationL1: 'test' }, // No jlptLevel
          ],
        },
      ];

      const result = await generateConversationalLessonScript(exchangeNoJlpt, mockContext);

      expect(result.units.length).toBeGreaterThan(0);
    });
  });
});
