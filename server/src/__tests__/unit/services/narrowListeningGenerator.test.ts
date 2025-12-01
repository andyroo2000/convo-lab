import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create hoisted mocks
const mockGenerateWithGemini = vi.hoisted(() => vi.fn());

vi.mock('../../../services/geminiClient.js', () => ({
  generateWithGemini: mockGenerateWithGemini,
}));

vi.mock('../../../../../shared/src/constants-new.js', () => ({
  SUPPORTED_LANGUAGES: {
    ja: { name: 'Japanese', code: 'ja' },
    zh: { name: 'Chinese', code: 'zh' },
    es: { name: 'Spanish', code: 'es' },
  },
}));

// Import after mocking
import { generateNarrowListeningPack, StoryPack } from '../../../services/narrowListeningGenerator.js';

describe('narrowListeningGenerator', () => {
  const mockStoryPack: StoryPack = {
    title: 'A Day at the Cafe',
    versions: [
      {
        variationType: 'PAST_CASUAL',
        title: 'Past tense, casual',
        segments: [
          { targetText: '昨日カフェに行った。', englishTranslation: 'I went to a cafe yesterday.' },
          { targetText: 'コーヒーを飲んだ。', englishTranslation: 'I drank coffee.' },
        ],
      },
      {
        variationType: 'PRESENT_POLITE',
        title: 'Present tense, polite',
        segments: [
          { targetText: '今日カフェに行きます。', englishTranslation: 'I am going to a cafe today.' },
          { targetText: 'コーヒーを飲みます。', englishTranslation: 'I will drink coffee.' },
        ],
      },
      {
        variationType: 'FUTURE_POLITE',
        title: 'Future/intention forms',
        segments: [
          { targetText: '明日カフェに行くつもりです。', englishTranslation: 'I plan to go to a cafe tomorrow.' },
          { targetText: 'コーヒーを飲む予定です。', englishTranslation: 'I plan to drink coffee.' },
        ],
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateWithGemini.mockResolvedValue(JSON.stringify(mockStoryPack));
  });

  describe('generateNarrowListeningPack', () => {
    it('should generate a story pack for Japanese', async () => {
      const result = await generateNarrowListeningPack(
        'A person visiting a cafe',
        'ja',
        'N4',
        3
      );

      expect(result.title).toBe('A Day at the Cafe');
      expect(result.versions).toHaveLength(3);
      expect(mockGenerateWithGemini).toHaveBeenCalledWith(
        expect.stringContaining('Japanese'),
        expect.any(String),
        'gemini-2.5-flash'
      );
    });

    it('should include topic in the prompt', async () => {
      await generateNarrowListeningPack(
        'Shopping at a convenience store',
        'ja',
        'N4',
        3
      );

      const prompt = mockGenerateWithGemini.mock.calls[0][0];
      expect(prompt).toContain('Shopping at a convenience store');
    });

    it('should include proficiency level description', async () => {
      await generateNarrowListeningPack(
        'Test topic',
        'ja',
        'N5',
        3
      );

      const prompt = mockGenerateWithGemini.mock.calls[0][0];
      expect(prompt).toContain('N5');
      expect(prompt).toContain('beginner level');
    });

    it('should include version count in the prompt', async () => {
      await generateNarrowListeningPack(
        'Test topic',
        'ja',
        'N4',
        5
      );

      const prompt = mockGenerateWithGemini.mock.calls[0][0];
      expect(prompt).toContain('5');
    });

    it('should include grammar focus when provided', async () => {
      await generateNarrowListeningPack(
        'Test topic',
        'ja',
        'N4',
        3,
        'Focus on particle は vs が'
      );

      const prompt = mockGenerateWithGemini.mock.calls[0][0];
      expect(prompt).toContain('Focus on particle は vs が');
    });

    it('should strip markdown code fences from response', async () => {
      mockGenerateWithGemini.mockResolvedValue('```json\n' + JSON.stringify(mockStoryPack) + '\n```');

      const result = await generateNarrowListeningPack(
        'Test topic',
        'ja',
        'N4',
        3
      );

      expect(result.title).toBe('A Day at the Cafe');
    });

    it('should throw error for invalid story pack structure', async () => {
      mockGenerateWithGemini.mockResolvedValue(JSON.stringify({ invalid: 'structure' }));

      await expect(generateNarrowListeningPack(
        'Test topic',
        'ja',
        'N4',
        3
      )).rejects.toThrow('Invalid story pack structure');
    });

    it('should throw error for invalid version structure', async () => {
      const invalidPack = {
        title: 'Test',
        versions: [{ invalidVersion: true }],
      };
      mockGenerateWithGemini.mockResolvedValue(JSON.stringify(invalidPack));

      await expect(generateNarrowListeningPack(
        'Test topic',
        'ja',
        'N4',
        3
      )).rejects.toThrow('Invalid version structure');
    });

    it('should throw error for invalid segment structure', async () => {
      const invalidPack = {
        title: 'Test',
        versions: [{
          variationType: 'TEST',
          title: 'Test',
          segments: [{ missingFields: true }],
        }],
      };
      mockGenerateWithGemini.mockResolvedValue(JSON.stringify(invalidPack));

      await expect(generateNarrowListeningPack(
        'Test topic',
        'ja',
        'N4',
        3
      )).rejects.toThrow('Invalid segment structure');
    });

    it('should throw error when Gemini fails', async () => {
      mockGenerateWithGemini.mockRejectedValue(new Error('API error'));

      await expect(generateNarrowListeningPack(
        'Test topic',
        'ja',
        'N4',
        3
      )).rejects.toThrow('Failed to generate narrow listening pack');
    });
  });

  describe('language-specific behavior', () => {
    describe('Japanese', () => {
      it('should include Japanese variation types in prompt', async () => {
        await generateNarrowListeningPack(
          'Test topic',
          'ja',
          'N4',
          3
        );

        const prompt = mockGenerateWithGemini.mock.calls[0][0];
        expect(prompt).toContain('PAST_CASUAL');
        expect(prompt).toContain('PRESENT_POLITE');
      });

      it('should include constraint about no furigana', async () => {
        await generateNarrowListeningPack(
          'Test topic',
          'ja',
          'N4',
          3
        );

        const systemInstruction = mockGenerateWithGemini.mock.calls[0][1];
        expect(systemInstruction).toContain('Do NOT use furigana');
      });

      it('should map N5/N4 to beginner level', async () => {
        await generateNarrowListeningPack(
          'Test topic',
          'ja',
          'N5',
          3
        );

        const prompt = mockGenerateWithGemini.mock.calls[0][0];
        expect(prompt).toContain('beginner level');
      });

      it('should map N3 to intermediate level', async () => {
        await generateNarrowListeningPack(
          'Test topic',
          'ja',
          'N3',
          3
        );

        const prompt = mockGenerateWithGemini.mock.calls[0][0];
        expect(prompt).toContain('intermediate level');
      });

      it('should map N2/N1 to advanced level', async () => {
        await generateNarrowListeningPack(
          'Test topic',
          'ja',
          'N1',
          3
        );

        const prompt = mockGenerateWithGemini.mock.calls[0][0];
        expect(prompt).toContain('advanced level');
      });
    });

    describe('Chinese', () => {
      it('should include Chinese variation types in prompt', async () => {
        await generateNarrowListeningPack(
          'Test topic',
          'zh',
          'HSK3',
          3
        );

        const prompt = mockGenerateWithGemini.mock.calls[0][0];
        expect(prompt).toContain('ASPECT_MARKERS');
        expect(prompt).toContain('BA_CONSTRUCTION');
      });

      it('should include constraint about no pinyin', async () => {
        await generateNarrowListeningPack(
          'Test topic',
          'zh',
          'HSK3',
          3
        );

        const systemInstruction = mockGenerateWithGemini.mock.calls[0][1];
        expect(systemInstruction).toContain('Do NOT include pinyin');
      });

      it('should map HSK1/HSK2 to beginner level', async () => {
        await generateNarrowListeningPack(
          'Test topic',
          'zh',
          'HSK1',
          3
        );

        const prompt = mockGenerateWithGemini.mock.calls[0][0];
        expect(prompt).toContain('beginner level');
      });

      it('should map HSK3/HSK4 to intermediate level', async () => {
        await generateNarrowListeningPack(
          'Test topic',
          'zh',
          'HSK4',
          3
        );

        const prompt = mockGenerateWithGemini.mock.calls[0][0];
        expect(prompt).toContain('intermediate level');
      });

      it('should map HSK5/HSK6 to advanced level', async () => {
        await generateNarrowListeningPack(
          'Test topic',
          'zh',
          'HSK6',
          3
        );

        const prompt = mockGenerateWithGemini.mock.calls[0][0];
        expect(prompt).toContain('advanced level');
      });
    });
  });

  describe('system instruction', () => {
    it('should include language name in system instruction', async () => {
      await generateNarrowListeningPack(
        'Test topic',
        'ja',
        'N4',
        3
      );

      const systemInstruction = mockGenerateWithGemini.mock.calls[0][1];
      expect(systemInstruction).toContain('Japanese');
    });

    it('should include goal description', async () => {
      await generateNarrowListeningPack(
        'Test topic',
        'ja',
        'N4',
        3
      );

      const systemInstruction = mockGenerateWithGemini.mock.calls[0][1];
      expect(systemInstruction).toContain('Narrow Listening');
      expect(systemInstruction).toContain('3–5 versions');
    });

    it('should include constraints about JSON output', async () => {
      await generateNarrowListeningPack(
        'Test topic',
        'ja',
        'N4',
        3
      );

      const systemInstruction = mockGenerateWithGemini.mock.calls[0][1];
      expect(systemInstruction).toContain('STRICT JSON');
      expect(systemInstruction).toContain('NO extra commentary');
    });
  });
});
