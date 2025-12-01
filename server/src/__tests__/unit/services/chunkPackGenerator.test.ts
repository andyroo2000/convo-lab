import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create hoisted mocks for Google Generative AI
const mockGenerateContent = vi.hoisted(() => vi.fn());
const mockGetGenerativeModel = vi.hoisted(() =>
  vi.fn(() => ({
    generateContent: mockGenerateContent,
  }))
);

vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: class {
      getGenerativeModel = mockGetGenerativeModel;
    },
  };
});

// Import after mocking
import { generateChunkPack } from '../../../services/chunkPackGenerator.js';
import type { GeneratedChunkPack } from '../../../types/chunkPack.js';

describe('chunkPackGenerator', () => {
  const mockChunkPackResponse: GeneratedChunkPack = {
    title: '毎日の習慣[しゅうかん] - Daily Routines',
    chunks: [
      {
        form: '〜てください',
        translation: 'please do ~',
        literalGloss: null,
        register: 'polite',
        function: 'making polite requests',
        notes: 'Very common, used in all polite contexts',
      },
      {
        form: '〜ています',
        translation: 'doing ~ / am ~ing',
        literalGloss: null,
        register: 'neutral',
        function: 'expressing ongoing actions or states',
        notes: 'Can indicate both current action and habitual behavior',
      },
    ],
    examples: [
      {
        chunkForm: '〜てください',
        sentence: '窓[まど]を開[あ]けてください。',
        english: 'Please open the window.',
        contextNote: 'classroom setting',
      },
      {
        chunkForm: '〜ています',
        sentence: '今[いま]、勉強[べんきょう]しています。',
        english: "I'm studying now.",
        contextNote: null,
      },
    ],
    stories: [
      {
        title: '朝[あさ]のルーティン',
        type: 'narrative',
        storyText:
          '毎朝[まいあさ]、6時[じ]に起[お]きています。コーヒーを飲[の]んでください。',
        english: 'Every morning, I wake up at 6 AM. Please drink coffee.',
        segments: [
          {
            japaneseText: '毎朝[まいあさ]、6時[じ]に起[お]きています。',
            englishTranslation: 'Every morning, I wake up at 6 AM.',
          },
          {
            japaneseText: 'コーヒーを飲[の]んでください。',
            englishTranslation: 'Please drink coffee.',
          },
        ],
      },
    ],
    exercises: [
      {
        exerciseType: 'chunk_to_meaning',
        prompt: '「〜てください」とは何ですか？',
        options: ['please do ~', 'I want to ~', 'I can ~'],
        correctOption: 'please do ~',
        explanation: 'Used for polite requests in Japanese',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementation
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => JSON.stringify(mockChunkPackResponse),
      },
    });
  });

  describe('generateChunkPack', () => {
    it('should generate chunk pack for N5 level with daily_routine theme', async () => {
      const result = await generateChunkPack('N5', 'daily_routine');

      expect(result).toBeDefined();
      expect(result.title).toBeDefined();
      expect(result.chunks).toBeInstanceOf(Array);
      expect(result.examples).toBeInstanceOf(Array);
      expect(result.stories).toBeInstanceOf(Array);
      expect(result.exercises).toBeInstanceOf(Array);
    });

    it('should call Gemini API with correct model configuration', async () => {
      await generateChunkPack('N5', 'daily_routine');

      expect(mockGetGenerativeModel).toHaveBeenCalledWith({
        model: 'gemini-2.0-flash-exp',
        generationConfig: {
          temperature: 0.9,
          responseMimeType: 'application/json',
        },
      });
    });

    it('should call generateContent with a prompt', async () => {
      await generateChunkPack('N4', 'travel');

      expect(mockGenerateContent).toHaveBeenCalled();
      const prompt = mockGenerateContent.mock.calls[0][0];
      expect(prompt).toContain('N4');
      expect(prompt).toContain('Travel');
    });

    it('should include JLPT level in the prompt', async () => {
      await generateChunkPack('N3', 'work');

      const prompt = mockGenerateContent.mock.calls[0][0];
      expect(prompt).toContain('N3');
    });

    it('should include theme information in the prompt', async () => {
      await generateChunkPack('N5', 'shopping');

      const prompt = mockGenerateContent.mock.calls[0][0];
      expect(prompt).toContain('Shopping');
    });

    it('should throw error when Gemini API fails', async () => {
      mockGenerateContent.mockRejectedValue(new Error('API Error'));

      await expect(generateChunkPack('N5', 'daily_routine')).rejects.toThrow(
        'Failed to generate chunk pack'
      );
    });

    it('should throw error when JSON parsing fails', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'invalid json',
        },
      });

      await expect(generateChunkPack('N5', 'daily_routine')).rejects.toThrow(
        'Failed to generate chunk pack'
      );
    });
  });

  describe('furigana cleaning', () => {
    it('should remove bracket notation furigana from title', async () => {
      const result = await generateChunkPack('N5', 'daily_routine');

      // Original: '毎日の習慣[しゅうかん] - Daily Routines'
      expect(result.title).not.toContain('[');
      expect(result.title).not.toContain(']');
      expect(result.title).toContain('毎日の習慣 - Daily Routines');
    });

    it('should remove furigana from chunk forms', async () => {
      const result = await generateChunkPack('N5', 'daily_routine');

      result.chunks.forEach((chunk) => {
        expect(chunk.form).not.toMatch(/\[[^\]]+\]/);
        expect(chunk.form).not.toMatch(/（[^）]+）/);
        expect(chunk.form).not.toMatch(/\([^)]+\)/);
      });
    });

    it('should remove furigana from example sentences', async () => {
      const result = await generateChunkPack('N5', 'daily_routine');

      result.examples.forEach((example) => {
        expect(example.sentence).not.toMatch(/\[[^\]]+\]/);
      });
    });

    it('should remove furigana from story text', async () => {
      const result = await generateChunkPack('N5', 'daily_routine');

      result.stories.forEach((story) => {
        expect(story.storyText).not.toMatch(/\[[^\]]+\]/);
        expect(story.title).not.toMatch(/\[[^\]]+\]/);
        story.segments.forEach((segment) => {
          expect(segment.japaneseText).not.toMatch(/\[[^\]]+\]/);
        });
      });
    });

    it('should remove furigana from exercise prompts and options', async () => {
      const result = await generateChunkPack('N5', 'daily_routine');

      result.exercises.forEach((exercise) => {
        expect(exercise.prompt).not.toMatch(/\[[^\]]+\]/);
        exercise.options.forEach((opt) => {
          expect(opt).not.toMatch(/\[[^\]]+\]/);
        });
        expect(exercise.correctOption).not.toMatch(/\[[^\]]+\]/);
      });
    });

    it('should handle full-width parentheses furigana', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              ...mockChunkPackResponse,
              title: '買（か）い物（もの）',
            }),
        },
      });

      const result = await generateChunkPack('N5', 'shopping');
      expect(result.title).not.toMatch(/（[^）]+）/);
      expect(result.title).toBe('買い物');
    });

    it('should handle half-width parentheses furigana', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              ...mockChunkPackResponse,
              title: '電話(でんわ)',
            }),
        },
      });

      const result = await generateChunkPack('N5', 'daily_routine');
      expect(result.title).not.toMatch(/\([^)]+\)/);
      expect(result.title).toBe('電話');
    });

    it('should clean up extra spaces after furigana removal', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              ...mockChunkPackResponse,
              title: '毎日[まいにち]   の   生活[せいかつ]',
            }),
        },
      });

      const result = await generateChunkPack('N5', 'daily_routine');
      expect(result.title).not.toMatch(/\s{2,}/); // No multiple consecutive spaces
      expect(result.title).toBe('毎日 の 生活');
    });
  });

  describe('different JLPT levels', () => {
    it('should handle N5 level', async () => {
      await generateChunkPack('N5', 'greetings');
      const prompt = mockGenerateContent.mock.calls[0][0];
      expect(prompt).toContain('N5');
      expect(prompt).toContain('basic');
    });

    it('should handle N4 level', async () => {
      await generateChunkPack('N4', 'health');
      const prompt = mockGenerateContent.mock.calls[0][0];
      expect(prompt).toContain('N4');
      expect(prompt).toContain('abstract');
    });

    it('should handle N3 level', async () => {
      await generateChunkPack('N3', 'work');
      const prompt = mockGenerateContent.mock.calls[0][0];
      expect(prompt).toContain('N3');
      expect(prompt).toContain('nuanced');
    });
  });

  describe('different themes', () => {
    const n5Themes = ['daily_routine', 'greetings', 'shopping', 'family', 'school', 'food', 'weather', 'hobbies'];
    const n4Themes = ['health', 'travel', 'opinions', 'plans', 'feelings', 'requests', 'advice', 'experiences'];
    const n3Themes = ['work', 'social_life', 'habits', 'expectations', 'comparisons', 'reasoning', 'preferences', 'goals'];

    n5Themes.forEach((theme) => {
      it(`should include theme-specific content for N5 ${theme}`, async () => {
        await generateChunkPack('N5', theme as any);
        const prompt = mockGenerateContent.mock.calls[0][0];
        expect(prompt.length).toBeGreaterThan(100); // Ensure prompt is generated
      });
    });

    n4Themes.forEach((theme) => {
      it(`should include theme-specific content for N4 ${theme}`, async () => {
        await generateChunkPack('N4', theme as any);
        const prompt = mockGenerateContent.mock.calls[0][0];
        expect(prompt.length).toBeGreaterThan(100);
      });
    });

    n3Themes.forEach((theme) => {
      it(`should include theme-specific content for N3 ${theme}`, async () => {
        await generateChunkPack('N3', theme as any);
        const prompt = mockGenerateContent.mock.calls[0][0];
        expect(prompt.length).toBeGreaterThan(100);
      });
    });
  });

  describe('prompt content', () => {
    it('should include pedagogical principles in prompt', async () => {
      await generateChunkPack('N5', 'daily_routine');
      const prompt = mockGenerateContent.mock.calls[0][0];
      expect(prompt).toContain('PEDAGOGICAL PRINCIPLES');
      expect(prompt).toContain('CHUNK FIRST');
      expect(prompt).toContain('HIGH FREQUENCY');
    });

    it('should include output requirements in prompt', async () => {
      await generateChunkPack('N5', 'daily_routine');
      const prompt = mockGenerateContent.mock.calls[0][0];
      expect(prompt).toContain('OUTPUT REQUIREMENTS');
      expect(prompt).toContain('chunks');
      expect(prompt).toContain('examples');
      expect(prompt).toContain('stories');
      expect(prompt).toContain('exercises');
    });

    it('should include exercise type guidance in prompt', async () => {
      await generateChunkPack('N5', 'daily_routine');
      const prompt = mockGenerateContent.mock.calls[0][0];
      expect(prompt).toContain('chunk_to_meaning');
      expect(prompt).toContain('meaning_to_chunk');
      expect(prompt).toContain('gap_fill_mc');
    });

    it('should include story requirements in prompt', async () => {
      await generateChunkPack('N5', 'daily_routine');
      const prompt = mockGenerateContent.mock.calls[0][0];
      expect(prompt).toContain('STORY REQUIREMENTS');
      expect(prompt).toContain('narrative');
      expect(prompt).toContain('dialogue');
    });

    it('should include quality control checklist in prompt', async () => {
      await generateChunkPack('N5', 'daily_routine');
      const prompt = mockGenerateContent.mock.calls[0][0];
      expect(prompt).toContain('QUALITY CONTROL CHECKLIST');
    });

    it('should include example chunks for theme', async () => {
      await generateChunkPack('N5', 'shopping');
      const prompt = mockGenerateContent.mock.calls[0][0];
      expect(prompt).toContain('〜をください');
      expect(prompt).toContain('いくらですか');
    });

    it('should include theme-specific priorities', async () => {
      await generateChunkPack('N5', 'daily_routine');
      const prompt = mockGenerateContent.mock.calls[0][0];
      expect(prompt).toContain('CHUNK SELECTION GUIDANCE');
    });
  });

  describe('vocabulary constraints by level', () => {
    it('should include N5 vocabulary constraints', async () => {
      await generateChunkPack('N5', 'daily_routine');
      const prompt = mockGenerateContent.mock.calls[0][0];
      expect(prompt).toContain('VOCABULARY CONSTRAINTS (N5)');
      expect(prompt).toContain('basic');
      expect(prompt).toContain('hiragana');
    });

    it('should include N4 vocabulary constraints', async () => {
      await generateChunkPack('N4', 'travel');
      const prompt = mockGenerateContent.mock.calls[0][0];
      expect(prompt).toContain('VOCABULARY CONSTRAINTS (N4)');
      expect(prompt).toContain('て-form');
    });

    it('should include N3 vocabulary constraints', async () => {
      await generateChunkPack('N3', 'work');
      const prompt = mockGenerateContent.mock.calls[0][0];
      expect(prompt).toContain('VOCABULARY CONSTRAINTS (N3)');
      expect(prompt).toContain('nuanced');
    });
  });

  describe('response structure validation', () => {
    it('should return all required fields', async () => {
      const result = await generateChunkPack('N5', 'daily_routine');

      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('chunks');
      expect(result).toHaveProperty('examples');
      expect(result).toHaveProperty('stories');
      expect(result).toHaveProperty('exercises');
    });

    it('should return chunks with correct structure', async () => {
      const result = await generateChunkPack('N5', 'daily_routine');

      expect(result.chunks.length).toBeGreaterThan(0);
      const chunk = result.chunks[0];
      expect(chunk).toHaveProperty('form');
      expect(chunk).toHaveProperty('translation');
      expect(chunk).toHaveProperty('register');
      expect(chunk).toHaveProperty('function');
      expect(chunk).toHaveProperty('notes');
    });

    it('should return examples with correct structure', async () => {
      const result = await generateChunkPack('N5', 'daily_routine');

      expect(result.examples.length).toBeGreaterThan(0);
      const example = result.examples[0];
      expect(example).toHaveProperty('chunkForm');
      expect(example).toHaveProperty('sentence');
      expect(example).toHaveProperty('english');
    });

    it('should return stories with correct structure', async () => {
      const result = await generateChunkPack('N5', 'daily_routine');

      expect(result.stories.length).toBeGreaterThan(0);
      const story = result.stories[0];
      expect(story).toHaveProperty('title');
      expect(story).toHaveProperty('type');
      expect(story).toHaveProperty('storyText');
      expect(story).toHaveProperty('english');
      expect(story).toHaveProperty('segments');
    });

    it('should return exercises with correct structure', async () => {
      const result = await generateChunkPack('N5', 'daily_routine');

      expect(result.exercises.length).toBeGreaterThan(0);
      const exercise = result.exercises[0];
      expect(exercise).toHaveProperty('exerciseType');
      expect(exercise).toHaveProperty('prompt');
      expect(exercise).toHaveProperty('options');
      expect(exercise).toHaveProperty('correctOption');
      expect(exercise).toHaveProperty('explanation');
    });
  });

  describe('error handling', () => {
    it('should log error when generation fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockGenerateContent.mockRejectedValue(new Error('Network error'));

      await expect(generateChunkPack('N5', 'daily_routine')).rejects.toThrow();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle empty response', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => '',
        },
      });

      await expect(generateChunkPack('N5', 'daily_routine')).rejects.toThrow(
        'Failed to generate chunk pack'
      );
    });
  });
});
