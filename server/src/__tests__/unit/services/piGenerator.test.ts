import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import after mocking
import {
  generatePISession,
  getGrammarPointsForLevel,
  getGrammarPointMetadata,
  isGrammarPointValidForLevel,
  GRAMMAR_POINTS,
  JLPTLevel,
  GrammarPointType,
  PISession,
  PIItem,
} from '../../../services/piGenerator.js';

// Create hoisted mocks
const mockGenerateContent = vi.hoisted(() => vi.fn());

// Mock the @google/generative-ai module with a proper class constructor
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class MockGoogleGenerativeAI {
    constructor() {}

    getGenerativeModel() {
      return {
        generateContent: mockGenerateContent,
      };
    }
  },
}));

describe('piGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GRAMMAR_POINTS constant', () => {
    it('should have all N5 grammar points', () => {
      const n5Points = Object.values(GRAMMAR_POINTS).filter((gp) => gp.level === 'N5');

      expect(n5Points.length).toBe(5);
      expect(n5Points.map((gp) => gp.id)).toContain('ha_vs_ga');
      expect(n5Points.map((gp) => gp.id)).toContain('ni_vs_de');
      expect(n5Points.map((gp) => gp.id)).toContain('wo_vs_ga');
      expect(n5Points.map((gp) => gp.id)).toContain('e_vs_ni');
      expect(n5Points.map((gp) => gp.id)).toContain('mada_vs_mou');
    });

    it('should have all N4 grammar points', () => {
      const n4Points = Object.values(GRAMMAR_POINTS).filter((gp) => gp.level === 'N4');

      expect(n4Points.length).toBe(5);
      expect(n4Points.map((gp) => gp.id)).toContain('kara_vs_node');
      expect(n4Points.map((gp) => gp.id)).toContain('ni_vs_to');
      expect(n4Points.map((gp) => gp.id)).toContain('teiru_aspect');
      expect(n4Points.map((gp) => gp.id)).toContain('to_vs_tari');
      expect(n4Points.map((gp) => gp.id)).toContain('ha_vs_mo');
    });

    it('should have all N3 grammar points', () => {
      const n3Points = Object.values(GRAMMAR_POINTS).filter((gp) => gp.level === 'N3');

      expect(n3Points.length).toBe(5);
      expect(n3Points.map((gp) => gp.id)).toContain('passive_vs_active');
      expect(n3Points.map((gp) => gp.id)).toContain('garu_vs_tai');
      expect(n3Points.map((gp) => gp.id)).toContain('koto_ni_naru_vs_suru');
      expect(n3Points.map((gp) => gp.id)).toContain('conditional_types');
      expect(n3Points.map((gp) => gp.id)).toContain('zu_ni_vs_nai_de');
    });

    it('should have all N2 grammar points', () => {
      const n2Points = Object.values(GRAMMAR_POINTS).filter((gp) => gp.level === 'N2');

      expect(n2Points.length).toBe(5);
      expect(n2Points.map((gp) => gp.id)).toContain('discourse_ha_vs_ga');
      expect(n2Points.map((gp) => gp.id)).toContain('wake_vs_hazu_vs_chigainai');
      expect(n2Points.map((gp) => gp.id)).toContain('causative_types');
      expect(n2Points.map((gp) => gp.id)).toContain('you_ni_vs_tame_ni');
      expect(n2Points.map((gp) => gp.id)).toContain('koto_da_vs_mono_da');
    });

    it('should have 20 total grammar points', () => {
      expect(Object.keys(GRAMMAR_POINTS).length).toBe(20);
    });

    it('should have correct categories for each grammar point', () => {
      // Particle-related
      expect(GRAMMAR_POINTS.ha_vs_ga.category).toBe('particles');
      expect(GRAMMAR_POINTS.ni_vs_de.category).toBe('particles');
      expect(GRAMMAR_POINTS.wo_vs_ga.category).toBe('particles');

      // Aspect-related
      expect(GRAMMAR_POINTS.mada_vs_mou.category).toBe('aspect');
      expect(GRAMMAR_POINTS.teiru_aspect.category).toBe('aspect');

      // Conditionals
      expect(GRAMMAR_POINTS.conditional_types.category).toBe('conditionals');

      // Voice
      expect(GRAMMAR_POINTS.passive_vs_active.category).toBe('voice');
      expect(GRAMMAR_POINTS.causative_types.category).toBe('voice');

      // Modality
      expect(GRAMMAR_POINTS.garu_vs_tai.category).toBe('modality');
    });
  });

  describe('getGrammarPointsForLevel', () => {
    it('should return all N5 grammar points', () => {
      const result = getGrammarPointsForLevel('N5');

      expect(result.length).toBe(5);
      expect(result).toContain('ha_vs_ga');
      expect(result).toContain('ni_vs_de');
    });

    it('should return all N4 grammar points', () => {
      const result = getGrammarPointsForLevel('N4');

      expect(result.length).toBe(5);
      expect(result).toContain('kara_vs_node');
      expect(result).toContain('teiru_aspect');
    });

    it('should return all N3 grammar points', () => {
      const result = getGrammarPointsForLevel('N3');

      expect(result.length).toBe(5);
      expect(result).toContain('passive_vs_active');
      expect(result).toContain('conditional_types');
    });

    it('should return all N2 grammar points', () => {
      const result = getGrammarPointsForLevel('N2');

      expect(result.length).toBe(5);
      expect(result).toContain('discourse_ha_vs_ga');
      expect(result).toContain('causative_types');
    });
  });

  describe('getGrammarPointMetadata', () => {
    it('should return metadata for ha_vs_ga', () => {
      const result = getGrammarPointMetadata('ha_vs_ga');

      expect(result.id).toBe('ha_vs_ga');
      expect(result.name).toBe('は vs が');
      expect(result.level).toBe('N5');
      expect(result.category).toBe('particles');
      expect(result.description).toContain('Topic vs subject');
    });

    it('should return metadata for teiru_aspect', () => {
      const result = getGrammarPointMetadata('teiru_aspect');

      expect(result.id).toBe('teiru_aspect');
      expect(result.name).toBe('〜ている');
      expect(result.level).toBe('N4');
      expect(result.category).toBe('aspect');
    });

    it('should return metadata for causative_types', () => {
      const result = getGrammarPointMetadata('causative_types');

      expect(result.id).toBe('causative_types');
      expect(result.name).toContain('Causative');
      expect(result.level).toBe('N2');
      expect(result.category).toBe('voice');
    });
  });

  describe('isGrammarPointValidForLevel', () => {
    it('should return true for ha_vs_ga at N5', () => {
      expect(isGrammarPointValidForLevel('ha_vs_ga', 'N5')).toBe(true);
    });

    it('should return false for ha_vs_ga at N4', () => {
      expect(isGrammarPointValidForLevel('ha_vs_ga', 'N4')).toBe(false);
    });

    it('should return true for teiru_aspect at N4', () => {
      expect(isGrammarPointValidForLevel('teiru_aspect', 'N4')).toBe(true);
    });

    it('should return true for causative_types at N2', () => {
      expect(isGrammarPointValidForLevel('causative_types', 'N2')).toBe(true);
    });

    it('should return false for N2 grammar at N5 level', () => {
      expect(isGrammarPointValidForLevel('discourse_ha_vs_ga', 'N5')).toBe(false);
    });
  });

  describe('generatePISession', () => {
    const mockPIItems: PIItem[] = [
      {
        type: 'who_did_it',
        question: 'Who came?',
        contextSentence: '田中さんと鈴木さんが公園にいます。',
        japaneseSentence: '田中さんが来ました。',
        audioText: '田中さんが来ました。',
        choices: [
          { id: 'a', text: 'Tanaka', isCorrect: true },
          { id: 'b', text: 'Suzuki', isCorrect: false },
        ],
        explanation: 'が marks Tanaka as the one who came.',
      },
      {
        type: 'topic_vs_subject',
        question: 'What is this sentence about?',
        japaneseSentence: '田中さんは学生です。',
        audioText: '田中さんは学生です。',
        choices: [
          { id: 'a', text: 'Talking about Tanaka, saying he is a student', isCorrect: true },
          { id: 'b', text: 'Identifying which person is the student', isCorrect: false },
        ],
        explanation: 'は sets up Tanaka as the topic.',
      },
    ];

    beforeEach(() => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({ items: mockPIItems }),
        },
      });
    });

    it('should generate a PI session with correct structure', async () => {
      const result = await generatePISession('N5', 5, 'ha_vs_ga');

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('jlptLevel');
      expect(result).toHaveProperty('grammarPoint');
      expect(result.jlptLevel).toBe('N5');
      expect(result.grammarPoint).toBe('ha_vs_ga');
    });

    it('should return items from API response', async () => {
      const result = await generatePISession('N5', 2, 'ha_vs_ga');

      expect(result.items).toHaveLength(2);
      expect(result.items[0].type).toBe('who_did_it');
      expect(result.items[1].type).toBe('topic_vs_subject');
    });

    it('should include question, japaneseSentence, and choices in items', async () => {
      const result = await generatePISession('N5', 2, 'ha_vs_ga');

      expect(result.items[0]).toHaveProperty('question');
      expect(result.items[0]).toHaveProperty('japaneseSentence');
      expect(result.items[0]).toHaveProperty('choices');
      expect(result.items[0].choices.length).toBeGreaterThan(0);
    });

    it('should include explanation in items', async () => {
      const result = await generatePISession('N5', 2, 'ha_vs_ga');

      expect(result.items[0].explanation).toBeDefined();
      expect(result.items[0].explanation.length).toBeGreaterThan(0);
    });

    it('should throw error on API failure', async () => {
      mockGenerateContent.mockRejectedValue(new Error('API error'));

      await expect(generatePISession('N5', 5, 'ha_vs_ga')).rejects.toThrow(
        'Failed to generate PI session'
      );
    });

    it('should throw error on invalid JSON response', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'Invalid JSON',
        },
      });

      await expect(generatePISession('N5', 5, 'ha_vs_ga')).rejects.toThrow(
        'Failed to generate PI session'
      );
    });

    it('should work with different JLPT levels', async () => {
      const levels: JLPTLevel[] = ['N5', 'N4', 'N3', 'N2'];

      for (const level of levels) {
        const grammarPoints = getGrammarPointsForLevel(level);
        const result = await generatePISession(level, 3, grammarPoints[0]);

        expect(result.jlptLevel).toBe(level);
      }
    });

    it('should work with different grammar points', async () => {
      const grammarPoints: GrammarPointType[] = ['ha_vs_ga', 'ni_vs_de', 'teiru_aspect'];

      for (const gp of grammarPoints) {
        const metadata = getGrammarPointMetadata(gp);
        const result = await generatePISession(metadata.level, 3, gp);

        expect(result.grammarPoint).toBe(gp);
      }
    });
  });

  describe('PI item types', () => {
    const mockItems = {
      who_did_it: {
        type: 'who_did_it' as const,
        question: 'Who came?',
        japaneseSentence: '田中さんが来ました。',
        audioText: '田中さんが来ました。',
        choices: [
          { id: 'a', text: 'Tanaka', isCorrect: true },
          { id: 'b', text: 'Suzuki', isCorrect: false },
        ],
        explanation: 'Test explanation',
      },
      topic_vs_subject: {
        type: 'topic_vs_subject' as const,
        question: 'What is this sentence about?',
        japaneseSentence: '田中さんは学生です。',
        audioText: '田中さんは学生です。',
        choices: [
          { id: 'a', text: 'About Tanaka', isCorrect: true },
          { id: 'b', text: 'Identifying student', isCorrect: false },
        ],
        explanation: 'Test explanation',
      },
      meaning_match: {
        type: 'meaning_match' as const,
        question: "Which means: It's Tanaka who came?",
        japaneseSentence: '田中さんが来ました。',
        audioText: '田中さんが来ました。',
        choices: [
          { id: 'a', text: 'Sentence A', isCorrect: false },
          { id: 'b', text: 'Sentence B', isCorrect: true },
        ],
        explanation: 'Test explanation',
        sentencePair: {
          sentenceA: '田中さんは来ました。',
          sentenceB: '田中さんが来ました。',
        },
      },
    };

    it('should handle who_did_it type', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({ items: [mockItems.who_did_it] }),
        },
      });

      const result = await generatePISession('N5', 1, 'ha_vs_ga');

      expect(result.items[0].type).toBe('who_did_it');
    });

    it('should handle topic_vs_subject type', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({ items: [mockItems.topic_vs_subject] }),
        },
      });

      const result = await generatePISession('N5', 1, 'ha_vs_ga');

      expect(result.items[0].type).toBe('topic_vs_subject');
    });

    it('should handle meaning_match type with sentence pair', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({ items: [mockItems.meaning_match] }),
        },
      });

      const result = await generatePISession('N5', 1, 'ha_vs_ga');

      expect(result.items[0].type).toBe('meaning_match');
      expect(result.items[0].sentencePair).toBeDefined();
      expect(result.items[0].sentencePair?.sentenceA).toBeDefined();
      expect(result.items[0].sentencePair?.sentenceB).toBeDefined();
    });
  });

  describe('vocabulary constraints by level', () => {
    beforeEach(() => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({ items: [] }),
        },
      });
    });

    it('should request N5 vocabulary constraints for N5 level', async () => {
      await generatePISession('N5', 3, 'ha_vs_ga');

      const promptArg = mockGenerateContent.mock.calls[0][0];
      expect(promptArg).toContain('very basic, concrete vocabulary');
      expect(promptArg).toContain('NO relative clauses');
    });

    it('should request N4 vocabulary constraints for N4 level', async () => {
      await generatePISession('N4', 3, 'teiru_aspect');

      const promptArg = mockGenerateContent.mock.calls[0][0];
      expect(promptArg).toContain('N5 + N4 vocabulary');
      expect(promptArg).toContain('simple relative clauses');
    });

    it('should request N3 vocabulary constraints for N3 level', async () => {
      await generatePISession('N3', 3, 'passive_vs_active');

      const promptArg = mockGenerateContent.mock.calls[0][0];
      expect(promptArg).toContain('N5/N4/N3 vocabulary');
      expect(promptArg).toContain('one relative clause');
    });

    it('should request N2 vocabulary constraints for N2 level', async () => {
      await generatePISession('N2', 3, 'causative_types');

      const promptArg = mockGenerateContent.mock.calls[0][0];
      expect(promptArg).toContain('N5/N4/N3/N2 vocabulary');
      expect(promptArg).toContain('complex clauses');
    });
  });

  describe('grammar-specific guidance', () => {
    beforeEach(() => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({ items: [] }),
        },
      });
    });

    it('should include ni_vs_de guidance for that grammar point', async () => {
      await generatePISession('N5', 3, 'ni_vs_de');

      const promptArg = mockGenerateContent.mock.calls[0][0];
      expect(promptArg).toContain('location of existence');
      expect(promptArg).toContain('location of action');
    });

    it('should include teiru_aspect guidance for that grammar point', async () => {
      await generatePISession('N4', 3, 'teiru_aspect');

      const promptArg = mockGenerateContent.mock.calls[0][0];
      expect(promptArg).toContain('result state');
      expect(promptArg).toContain('progressive action');
    });

    it('should include passive_vs_active guidance for that grammar point', async () => {
      await generatePISession('N3', 3, 'passive_vs_active');

      const promptArg = mockGenerateContent.mock.calls[0][0];
      expect(promptArg).toContain('Passive');
      expect(promptArg).toContain('Active');
      expect(promptArg).toContain('receiver');
    });

    it('should include causative_types guidance for that grammar point', async () => {
      await generatePISession('N2', 3, 'causative_types');

      const promptArg = mockGenerateContent.mock.calls[0][0];
      expect(promptArg).toContain('Causative');
      expect(promptArg).toContain('Causative-passive');
    });
  });
});
