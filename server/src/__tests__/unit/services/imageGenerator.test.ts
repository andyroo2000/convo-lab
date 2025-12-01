import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mocks
const mockGenerateWithGemini = vi.hoisted(() => vi.fn());
const mockUploadImage = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  dialogue: {
    findUnique: vi.fn(),
  },
  episode: {
    findUnique: vi.fn(),
  },
  image: {
    create: vi.fn(),
  },
}));

// Mock dependencies
vi.mock('../../../db/client.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../../services/geminiClient.js', () => ({
  generateWithGemini: mockGenerateWithGemini,
}));

vi.mock('../../../services/storageClient.js', () => ({
  uploadImage: mockUploadImage,
}));

// Import after mocking
import { generateDialogueImages } from '../../../services/imageGenerator.js';

describe('imageGenerator', () => {
  const mockDialogue = {
    id: 'dialogue-123',
    sentences: [
      { id: 'sent-1', text: 'こんにちは', order: 0 },
      { id: 'sent-2', text: 'お元気ですか', order: 1 },
      { id: 'sent-3', text: 'はい、元気です', order: 2 },
      { id: 'sent-4', text: 'よかったです', order: 3 },
      { id: 'sent-5', text: 'また会いましょう', order: 4 },
      { id: 'sent-6', text: 'さようなら', order: 5 },
    ],
  };

  const mockEpisode = {
    id: 'episode-456',
    sourceText: 'Two friends meeting at a cafe',
    targetLanguage: 'ja',
    title: 'At the Cafe',
  };

  const mockGeneratedPrompt = 'A realistic scene of two friends talking at a Japanese cafe';

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.dialogue.findUnique.mockResolvedValue(mockDialogue);
    mockPrisma.episode.findUnique.mockResolvedValue(mockEpisode);
    mockGenerateWithGemini.mockResolvedValue(mockGeneratedPrompt);
    mockPrisma.image.create.mockImplementation(async ({ data }) => ({
      id: `image-${data.order}`,
      ...data,
    }));
  });

  describe('generateDialogueImages', () => {
    it('should throw error if dialogue not found', async () => {
      mockPrisma.dialogue.findUnique.mockResolvedValue(null);

      await expect(generateDialogueImages({
        episodeId: 'episode-456',
        dialogueId: 'nonexistent',
      })).rejects.toThrow('Dialogue not found');
    });

    it('should throw error if episode not found', async () => {
      mockPrisma.episode.findUnique.mockResolvedValue(null);

      await expect(generateDialogueImages({
        episodeId: 'nonexistent',
        dialogueId: 'dialogue-123',
      })).rejects.toThrow('Episode not found');
    });

    it('should use default imageCount of 3', async () => {
      await generateDialogueImages({
        episodeId: 'episode-456',
        dialogueId: 'dialogue-123',
      });

      // With 6 sentences and 3 images, each image covers 2 sentences
      expect(mockPrisma.image.create).toHaveBeenCalledTimes(3);
    });

    it('should divide dialogue into sections by imageCount', async () => {
      await generateDialogueImages({
        episodeId: 'episode-456',
        dialogueId: 'dialogue-123',
        imageCount: 2,
      });

      // With 6 sentences and 2 images, each image covers 3 sentences
      expect(mockPrisma.image.create).toHaveBeenCalledTimes(2);
    });

    it('should skip empty sections', async () => {
      mockPrisma.dialogue.findUnique.mockResolvedValue({
        ...mockDialogue,
        sentences: [
          { id: 'sent-1', text: 'こんにちは', order: 0 },
        ],
      });

      await generateDialogueImages({
        episodeId: 'episode-456',
        dialogueId: 'dialogue-123',
        imageCount: 5, // More images than sentences
      });

      // Only 1 image should be created since only 1 sentence
      expect(mockPrisma.image.create).toHaveBeenCalledTimes(1);
    });

    it('should call generateImagePrompt for each section', async () => {
      await generateDialogueImages({
        episodeId: 'episode-456',
        dialogueId: 'dialogue-123',
        imageCount: 3,
      });

      expect(mockGenerateWithGemini).toHaveBeenCalledTimes(3);
    });

    it('should include source text in image prompt generation', async () => {
      await generateDialogueImages({
        episodeId: 'episode-456',
        dialogueId: 'dialogue-123',
        imageCount: 1,
      });

      expect(mockGenerateWithGemini).toHaveBeenCalledWith(
        expect.stringContaining('Two friends meeting at a cafe'),
        expect.any(String)
      );
    });

    it('should include dialogue section in image prompt generation', async () => {
      await generateDialogueImages({
        episodeId: 'episode-456',
        dialogueId: 'dialogue-123',
        imageCount: 1,
      });

      expect(mockGenerateWithGemini).toHaveBeenCalledWith(
        expect.stringContaining('こんにちは'),
        expect.any(String)
      );
    });

    it('should create Image records with prompt and order', async () => {
      await generateDialogueImages({
        episodeId: 'episode-456',
        dialogueId: 'dialogue-123',
        imageCount: 2,
      });

      expect(mockPrisma.image.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          episodeId: 'episode-456',
          prompt: mockGeneratedPrompt,
          order: 0,
        }),
      });

      expect(mockPrisma.image.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          episodeId: 'episode-456',
          prompt: mockGeneratedPrompt,
          order: 1,
        }),
      });
    });

    it('should link images to sentenceStartId and sentenceEndId', async () => {
      await generateDialogueImages({
        episodeId: 'episode-456',
        dialogueId: 'dialogue-123',
        imageCount: 3,
      });

      // First image: sentences 1-2
      expect(mockPrisma.image.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          order: 0,
          sentenceStartId: 'sent-1',
          sentenceEndId: 'sent-2',
        }),
      });

      // Second image: sentences 3-4
      expect(mockPrisma.image.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          order: 1,
          sentenceStartId: 'sent-3',
          sentenceEndId: 'sent-4',
        }),
      });

      // Third image: sentences 5-6
      expect(mockPrisma.image.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          order: 2,
          sentenceStartId: 'sent-5',
          sentenceEndId: 'sent-6',
        }),
      });
    });

    it('should return array of created images', async () => {
      const result = await generateDialogueImages({
        episodeId: 'episode-456',
        dialogueId: 'dialogue-123',
        imageCount: 2,
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('prompt');
      expect(result[0]).toHaveProperty('order', 0);
      expect(result[1]).toHaveProperty('order', 1);
    });

    it('should generate placeholder URLs for images', async () => {
      await generateDialogueImages({
        episodeId: 'episode-456',
        dialogueId: 'dialogue-123',
        imageCount: 2,
      });

      expect(mockPrisma.image.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          url: expect.stringContaining('placehold.co'),
        }),
      });
    });
  });
});
