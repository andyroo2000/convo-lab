import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create hoisted mocks
const mockGenerateWithGemini = vi.hoisted(() => vi.fn());
const mockGetAvatarUrlFromVoice = vi.hoisted(() => vi.fn());
const mockParseVoiceIdForGender = vi.hoisted(() => vi.fn());
const mockProcessLanguageTextBatch = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  episode: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  dialogue: {
    create: vi.fn(),
  },
  speaker: {
    create: vi.fn(),
  },
  sentence: {
    create: vi.fn(),
  },
}));

// Mock dependencies
vi.mock('../../../services/geminiClient.js', () => ({
  generateWithGemini: mockGenerateWithGemini,
}));

vi.mock('../../../services/avatarService.js', () => ({
  getAvatarUrlFromVoice: mockGetAvatarUrlFromVoice,
  parseVoiceIdForGender: mockParseVoiceIdForGender,
}));

vi.mock('../../../services/languageProcessor.js', () => ({
  processLanguageTextBatch: mockProcessLanguageTextBatch,
}));

vi.mock('../../../db/client.js', () => ({
  prisma: mockPrisma,
}));

// Import after mocking
import { generateDialogue } from '../../../services/dialogueGenerator.js';

describe('dialogueGenerator', () => {
  const mockEpisode = {
    id: 'episode-123',
    title: 'Test Episode',
    sourceText: 'Two friends talking about their weekend',
    targetLanguage: 'ja',
    nativeLanguage: 'en',
    status: 'pending',
  };

  const mockSpeakers = [
    { name: '田中[たなか]', voiceId: 'ja-JP-Neural2-B', proficiency: 'native', tone: 'casual' },
    { name: '山田[やまだ]', voiceId: 'ja-JP-Neural2-C', proficiency: 'intermediate', tone: 'polite' },
  ];

  const mockDialogueResponse = {
    title: 'Weekend Plans',
    sentences: [
      {
        speaker: '田中',
        text: 'こんにちは',
        translation: 'Hello',
        variations: ['こんにちわ', 'おはよう'],
      },
      {
        speaker: '山田',
        text: 'お元気ですか',
        translation: 'How are you?',
        variations: ['元気？', '調子はどう？'],
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockPrisma.episode.findUnique.mockResolvedValue(mockEpisode);
    mockPrisma.episode.update.mockResolvedValue(mockEpisode);
    mockPrisma.dialogue.create.mockResolvedValue({ id: 'dialogue-123', episodeId: 'episode-123' });
    mockPrisma.speaker.create.mockImplementation(async ({ data }) => ({
      id: `speaker-${data.name}`,
      ...data,
    }));
    mockPrisma.sentence.create.mockImplementation(async ({ data }) => ({
      id: `sentence-${data.order}`,
      ...data,
    }));

    mockGenerateWithGemini.mockResolvedValue(JSON.stringify(mockDialogueResponse));
    mockGetAvatarUrlFromVoice.mockResolvedValue('https://storage.example.com/avatar.jpg');
    mockParseVoiceIdForGender.mockReturnValue('female');
    mockProcessLanguageTextBatch.mockResolvedValue([
      { japanese: { kanji: 'こんにちは', kana: 'こんにちは', furigana: 'こんにちは' } },
      { japanese: { kanji: 'お元気ですか', kana: 'おげんきですか', furigana: 'お元[げん]気[き]ですか' } },
    ]);
  });

  describe('generateDialogue', () => {
    it('should generate dialogue and create database records', async () => {
      const result = await generateDialogue({
        episodeId: 'episode-123',
        speakers: mockSpeakers,
      });

      expect(mockPrisma.episode.findUnique).toHaveBeenCalledWith({
        where: { id: 'episode-123' },
      });
      expect(mockPrisma.episode.update).toHaveBeenCalledWith({
        where: { id: 'episode-123' },
        data: { status: 'generating' },
      });
      expect(mockGenerateWithGemini).toHaveBeenCalled();
      expect(mockPrisma.dialogue.create).toHaveBeenCalled();
      expect(result).toHaveProperty('dialogue');
      expect(result).toHaveProperty('speakers');
      expect(result).toHaveProperty('sentences');
    });

    it('should throw error if episode not found', async () => {
      mockPrisma.episode.findUnique.mockResolvedValue(null);

      await expect(generateDialogue({
        episodeId: 'nonexistent',
        speakers: mockSpeakers,
      })).rejects.toThrow('Episode not found');
    });

    it('should update episode status to error on failure', async () => {
      mockGenerateWithGemini.mockRejectedValue(new Error('API error'));

      await expect(generateDialogue({
        episodeId: 'episode-123',
        speakers: mockSpeakers,
      })).rejects.toThrow('API error');

      expect(mockPrisma.episode.update).toHaveBeenCalledWith({
        where: { id: 'episode-123' },
        data: { status: 'error' },
      });
    });

    it('should strip markdown code fences from response', async () => {
      mockGenerateWithGemini.mockResolvedValue('```json\n' + JSON.stringify(mockDialogueResponse) + '\n```');

      const result = await generateDialogue({
        episodeId: 'episode-123',
        speakers: mockSpeakers,
      });

      expect(result).toHaveProperty('dialogue');
    });

    it('should use default variation count and dialogue length', async () => {
      await generateDialogue({
        episodeId: 'episode-123',
        speakers: mockSpeakers,
      });

      const prompt = mockGenerateWithGemini.mock.calls[0][0];
      expect(prompt).toContain('3 alternative ways');
      expect(prompt).toContain('EXACTLY 6 dialogue lines');
    });

    it('should use custom variation count and dialogue length', async () => {
      await generateDialogue({
        episodeId: 'episode-123',
        speakers: mockSpeakers,
        variationCount: 5,
        dialogueLength: 10,
      });

      const prompt = mockGenerateWithGemini.mock.calls[0][0];
      expect(prompt).toContain('5 alternative ways');
      expect(prompt).toContain('EXACTLY 10 dialogue lines');
    });

    it('should batch process language metadata for sentences', async () => {
      await generateDialogue({
        episodeId: 'episode-123',
        speakers: mockSpeakers,
      });

      expect(mockProcessLanguageTextBatch).toHaveBeenCalledWith(
        ['こんにちは', 'お元気ですか'],
        'ja'
      );
    });

    it('should create speakers with avatar URLs', async () => {
      await generateDialogue({
        episodeId: 'episode-123',
        speakers: mockSpeakers,
      });

      expect(mockGetAvatarUrlFromVoice).toHaveBeenCalledWith('ja-JP-Neural2-B', 'casual');
      expect(mockGetAvatarUrlFromVoice).toHaveBeenCalledWith('ja-JP-Neural2-C', 'polite');
    });

    it('should parse gender from voice ID', async () => {
      await generateDialogue({
        episodeId: 'episode-123',
        speakers: mockSpeakers,
      });

      expect(mockParseVoiceIdForGender).toHaveBeenCalledWith('ja-JP-Neural2-B');
      expect(mockParseVoiceIdForGender).toHaveBeenCalledWith('ja-JP-Neural2-C');
    });

    it('should update episode with LLM-generated title', async () => {
      await generateDialogue({
        episodeId: 'episode-123',
        speakers: mockSpeakers,
      });

      // Check that episode was updated with status 'ready' and new title
      const updateCalls = mockPrisma.episode.update.mock.calls;
      const readyUpdate = updateCalls.find(call =>
        call[0].data.status === 'ready'
      );
      expect(readyUpdate[0].data.title).toBe('Weekend Plans');
    });

    it('should strip furigana from speaker names in prompts', async () => {
      await generateDialogue({
        episodeId: 'episode-123',
        speakers: mockSpeakers,
      });

      const systemInstruction = mockGenerateWithGemini.mock.calls[0][1];
      const prompt = mockGenerateWithGemini.mock.calls[0][0];

      // Should use stripped names (田中, not 田中[たなか])
      expect(systemInstruction).toContain('田中');
      expect(systemInstruction).not.toContain('[たなか]');
      expect(prompt).toContain('田中');
      expect(prompt).not.toContain('[たなか]');
    });

    it('should handle response without title', async () => {
      const responseWithoutTitle = {
        sentences: mockDialogueResponse.sentences,
      };
      mockGenerateWithGemini.mockResolvedValue(JSON.stringify(responseWithoutTitle));

      await generateDialogue({
        episodeId: 'episode-123',
        speakers: mockSpeakers,
      });

      // Should fallback to original title
      const updateCalls = mockPrisma.episode.update.mock.calls;
      const readyUpdate = updateCalls.find(call =>
        call[0].data.status === 'ready'
      );
      expect(readyUpdate[0].data.title).toBe('Test Episode');
    });

    it('should assign default colors to speakers', async () => {
      const speakersWithoutColors = [
        { name: '田中', voiceId: 'ja-JP-Neural2-B', proficiency: 'native', tone: 'casual' },
        { name: '山田', voiceId: 'ja-JP-Neural2-C', proficiency: 'native', tone: 'casual' },
      ];

      await generateDialogue({
        episodeId: 'episode-123',
        speakers: speakersWithoutColors,
      });

      const speakerCalls = mockPrisma.speaker.create.mock.calls;
      expect(speakerCalls[0][0].data.color).toBe('#9333EA'); // Purple
      expect(speakerCalls[1][0].data.color).toBe('#F97316'); // Orange
    });

    it('should use custom speaker colors when provided', async () => {
      const speakersWithColors = [
        { name: '田中', voiceId: 'ja-JP-Neural2-B', proficiency: 'native', tone: 'casual', color: '#FF0000' },
        { name: '山田', voiceId: 'ja-JP-Neural2-C', proficiency: 'native', tone: 'casual', color: '#00FF00' },
      ];

      await generateDialogue({
        episodeId: 'episode-123',
        speakers: speakersWithColors,
      });

      const speakerCalls = mockPrisma.speaker.create.mock.calls;
      expect(speakerCalls[0][0].data.color).toBe('#FF0000');
      expect(speakerCalls[1][0].data.color).toBe('#00FF00');
    });
  });

  describe('system instruction building', () => {
    it('should include correct language name for Japanese', async () => {
      await generateDialogue({
        episodeId: 'episode-123',
        speakers: mockSpeakers,
      });

      const systemInstruction = mockGenerateWithGemini.mock.calls[0][1];
      expect(systemInstruction).toContain('Japanese');
    });

    it('should include speaker proficiency and tone', async () => {
      await generateDialogue({
        episodeId: 'episode-123',
        speakers: mockSpeakers,
      });

      const systemInstruction = mockGenerateWithGemini.mock.calls[0][1];
      expect(systemInstruction).toContain('native, casual');
      expect(systemInstruction).toContain('intermediate, polite');
    });
  });

  describe('dialogue prompt building', () => {
    it('should include source text in prompt', async () => {
      await generateDialogue({
        episodeId: 'episode-123',
        speakers: mockSpeakers,
      });

      const prompt = mockGenerateWithGemini.mock.calls[0][0];
      expect(prompt).toContain('Two friends talking about their weekend');
    });

    it('should include JSON format specification', async () => {
      await generateDialogue({
        episodeId: 'episode-123',
        speakers: mockSpeakers,
      });

      const prompt = mockGenerateWithGemini.mock.calls[0][0];
      expect(prompt).toContain('Return your response as JSON');
      expect(prompt).toContain('"title"');
      expect(prompt).toContain('"sentences"');
    });
  });

  describe('different target languages', () => {
    it('should handle Chinese language', async () => {
      mockPrisma.episode.findUnique.mockResolvedValue({
        ...mockEpisode,
        targetLanguage: 'zh',
      });

      await generateDialogue({
        episodeId: 'episode-123',
        speakers: mockSpeakers,
      });

      const systemInstruction = mockGenerateWithGemini.mock.calls[0][1];
      expect(systemInstruction).toContain('Chinese');
    });

    it('should handle Spanish language', async () => {
      mockPrisma.episode.findUnique.mockResolvedValue({
        ...mockEpisode,
        targetLanguage: 'es',
      });

      await generateDialogue({
        episodeId: 'episode-123',
        speakers: mockSpeakers,
      });

      const systemInstruction = mockGenerateWithGemini.mock.calls[0][1];
      expect(systemInstruction).toContain('Spanish');
    });

    it('should handle French language', async () => {
      mockPrisma.episode.findUnique.mockResolvedValue({
        ...mockEpisode,
        targetLanguage: 'fr',
      });

      await generateDialogue({
        episodeId: 'episode-123',
        speakers: mockSpeakers,
      });

      const systemInstruction = mockGenerateWithGemini.mock.calls[0][1];
      expect(systemInstruction).toContain('French');
    });
  });
});
