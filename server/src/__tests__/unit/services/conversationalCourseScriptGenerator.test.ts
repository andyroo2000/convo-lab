import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mock
const mockGenerateWithGemini = vi.hoisted(() => vi.fn());

// Mock dependencies
vi.mock('../../../services/geminiClient.js', () => ({
  generateWithGemini: mockGenerateWithGemini,
}));

// Import after mocking
import { generateConversationalCourseScript } from '../../../services/conversationalCourseScriptGenerator.js';
import type { DialogueExchange, VocabularyItem } from '../../../services/courseItemExtractor.js';

describe('conversationalCourseScriptGenerator', () => {
  const mockContext = {
    episodeTitle: 'Meeting a Colleague',
    targetLanguage: 'ja',
    nativeLanguage: 'en',
    l1VoiceId: 'en-US-Neural2-D',
    l2VoiceIds: {
      'Colleague': 'ja-JP-Neural2-B',
    },
    jlptLevel: 'N3',
  };

  const mockVocabItem: VocabularyItem = {
    textL2: '初めまして',
    readingL2: 'はじめまして',
    translationL1: 'Nice to meet you',
    jlptLevel: 'N5',
  };

  const mockExchanges: DialogueExchange[] = [
    {
      order: 0,
      speakerName: 'Colleague',
      relationshipName: 'Your colleague',
      speakerVoiceId: 'ja-JP-Neural2-B',
      textL2: 'こんにちは、お名前は？',
      readingL2: 'こんにちは、おなまえは？',
      translationL1: "Hello, what's your name?",
      vocabularyItems: [mockVocabItem],
    },
    {
      order: 1,
      speakerName: 'You',
      relationshipName: 'You',
      speakerVoiceId: 'ja-JP-Neural2-C',
      textL2: '私の名前は田中です',
      readingL2: 'わたしのなまえはたなかです',
      translationL1: 'My name is Tanaka',
      vocabularyItems: [
        { textL2: '名前', readingL2: 'なまえ', translationL1: 'name', jlptLevel: 'N4' },
      ],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateWithGemini.mockResolvedValue(
      'Pretend you are meeting a new colleague at your office in Tokyo.'
    );
  });

  describe('generateConversationalCourseScript', () => {
    it('should generate intro with AI-generated scenario', async () => {
      const result = await generateConversationalCourseScript(mockExchanges, mockContext);

      expect(mockGenerateWithGemini).toHaveBeenCalled();
      const scenarioUnit = result.units.find(
        u => u.type === 'narration_L1' && u.text.includes('Pretend')
      );
      expect(scenarioUnit).toBeDefined();
    });

    it('should include JLPT level in scenario prompt', async () => {
      await generateConversationalCourseScript(mockExchanges, mockContext);

      const call = mockGenerateWithGemini.mock.calls[0][0];
      expect(call).toContain('JLPT N3');
    });

    it('should use fallback intro on AI failure', async () => {
      mockGenerateWithGemini.mockRejectedValue(new Error('AI error'));

      const result = await generateConversationalCourseScript(mockExchanges, mockContext);

      const fallbackUnit = result.units.find(
        u => u.type === 'narration_L1' && u.text.includes('Welcome to this lesson')
      );
      expect(fallbackUnit).toBeDefined();
    });

    it('should include lesson start and end markers', async () => {
      const result = await generateConversationalCourseScript(mockExchanges, mockContext);

      const markers = result.units.filter(u => u.type === 'marker');
      expect(markers.length).toBeGreaterThanOrEqual(2);
      expect(markers.some(m => m.label === 'Lesson Start')).toBe(true);
      expect(markers.some(m => m.label === 'Lesson End')).toBe(true);
    });

    it('should include outro narration', async () => {
      const result = await generateConversationalCourseScript(mockExchanges, mockContext);

      const outroUnit = result.units.find(
        u => u.type === 'narration_L1' && u.text.includes('Great work')
      );
      expect(outroUnit).toBeDefined();
    });

    it('should return estimated duration', async () => {
      const result = await generateConversationalCourseScript(mockExchanges, mockContext);

      expect(result.estimatedDurationSeconds).toBeGreaterThan(0);
    });

    it('should process odd-indexed exchanges as user responses', async () => {
      const result = await generateConversationalCourseScript(mockExchanges, mockContext);

      const respondUnit = result.units.find(
        u => u.type === 'narration_L1' && u.text.includes('You respond')
      );
      expect(respondUnit).toBeDefined();
    });

    it('should process even-indexed exchanges as questions', async () => {
      const result = await generateConversationalCourseScript(mockExchanges, mockContext);

      const saysUnit = result.units.find(
        u => u.type === 'narration_L1' && u.text.includes('says:')
      );
      expect(saysUnit).toBeDefined();
    });

    it('should include L2 units for dialogue', async () => {
      const result = await generateConversationalCourseScript(mockExchanges, mockContext);

      const l2Units = result.units.filter(u => u.type === 'L2');
      expect(l2Units.length).toBeGreaterThan(0);
    });

    it('should include pause units', async () => {
      const result = await generateConversationalCourseScript(mockExchanges, mockContext);

      const pauseUnits = result.units.filter(u => u.type === 'pause');
      expect(pauseUnits.length).toBeGreaterThan(0);
    });

    it('should use correct voice IDs', async () => {
      const result = await generateConversationalCourseScript(mockExchanges, mockContext);

      const l1Units = result.units.filter(u => u.type === 'narration_L1');
      l1Units.forEach(unit => {
        expect(unit.voiceId).toBe('en-US-Neural2-D');
      });

      const l2Units = result.units.filter(u => u.type === 'L2');
      l2Units.forEach(unit => {
        expect(['ja-JP-Neural2-B', 'ja-JP-Neural2-C']).toContain(unit.voiceId);
      });
    });

    it('should include translation for questions', async () => {
      const result = await generateConversationalCourseScript(mockExchanges, mockContext);

      const translationUnit = result.units.find(
        u => u.type === 'narration_L1' && u.text.includes('That means:')
      );
      expect(translationUnit).toBeDefined();
    });

    it('should include slow and normal speed versions', async () => {
      const result = await generateConversationalCourseScript(mockExchanges, mockContext);

      const l2Units = result.units.filter(u => u.type === 'L2');
      const speeds = l2Units.map(u => u.speed);
      expect(speeds).toContain(0.75);
      expect(speeds).toContain(1.0);
    });

    it('should filter vocabulary below JLPT level', async () => {
      // Vocab with N5 level should be filtered for N3 learner
      const result = await generateConversationalCourseScript(mockExchanges, mockContext);

      // The N5 vocab item should not be taught to N3 learner
      const l2Units = result.units.filter(u => u.type === 'L2');
      const hasN5Vocab = l2Units.some(u => u.text === '初めまして');
      expect(hasN5Vocab).toBe(false);
    });

    it('should work without JLPT level context', async () => {
      const contextNoJlpt = { ...mockContext, jlptLevel: undefined };

      const result = await generateConversationalCourseScript(mockExchanges, contextNoJlpt);

      expect(result.units.length).toBeGreaterThan(0);
    });

    it('should work with empty exchanges', async () => {
      const result = await generateConversationalCourseScript([], mockContext);

      expect(result.units.length).toBeGreaterThan(0);
      expect(result.estimatedDurationSeconds).toBeGreaterThan(0);
    });

    it('should normalize slashes in narrator text', async () => {
      const exchangeWithSlash: DialogueExchange[] = [
        {
          order: 0,
          speakerName: 'Other',
          relationshipName: 'Friend',
          speakerVoiceId: 'ja-JP-Neural2-B',
          textL2: 'テスト',
          readingL2: null,
          translationL1: 'in/at the park',
          vocabularyItems: [],
        },
      ];

      const result = await generateConversationalCourseScript(exchangeWithSlash, mockContext);

      const narratorUnits = result.units.filter(u => u.type === 'narration_L1');
      const hasSlash = narratorUnits.some(u => u.text.includes('/'));
      expect(hasSlash).toBe(false);
    });
  });
});
