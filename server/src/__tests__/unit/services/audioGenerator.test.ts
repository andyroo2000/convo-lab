import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import after mocking
import { generateEpisodeAudio, generateAllSpeedsAudio } from '../../../services/audioGenerator.js';

// Create hoisted mocks
const mockSynthesizeSpeech = vi.hoisted(() => vi.fn());
const mockCreateSSMLWithPauses = vi.hoisted(() => vi.fn());
const mockSynthesizeBatchedTexts = vi.hoisted(() => vi.fn());
const mockUploadAudio = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  dialogue: {
    findUnique: vi.fn(),
  },
  episode: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  sentence: {
    update: vi.fn(),
  },
}));
const mockFfmpeg = vi.hoisted(() => {
  const mockInstance = {
    input: vi.fn().mockReturnThis(),
    inputOptions: vi.fn().mockReturnThis(),
    outputOptions: vi.fn().mockReturnThis(),
    output: vi.fn().mockReturnThis(),
    setStartTime: vi.fn().mockReturnThis(),
    setDuration: vi.fn().mockReturnThis(),
    audioCodec: vi.fn().mockReturnThis(),
    audioBitrate: vi.fn().mockReturnThis(),
    audioFrequency: vi.fn().mockReturnThis(),
    audioChannels: vi.fn().mockReturnThis(),
    on: vi.fn().mockImplementation(function (
      this: typeof mockInstance,
      event: string,
      callback: () => void
    ) {
      if (event === 'end') {
        setTimeout(() => callback(), 0);
      }
      return this;
    }),
    run: vi.fn(),
  };
  const ffmpegFn = vi.fn(() => mockInstance);
  (
    ffmpegFn as unknown as {
      ffprobe: (
        path: string,
        cb: (err: unknown, data: { format: { duration: number } }) => void
      ) => void;
    }
  ).ffprobe = vi.fn((path, cb) => {
    cb(null, { format: { duration: 2.5 } }); // 2.5 seconds
  });
  (ffmpegFn as unknown as { setFfprobePath: (path: string) => void }).setFfprobePath = vi.fn();
  (ffmpegFn as unknown as { setFfmpegPath: (path: string) => void }).setFfmpegPath = vi.fn();
  return { ffmpegFn, mockInstance };
});
const mockFs = vi.hoisted(() => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(Buffer.from('audio data')),
  unlink: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  rm: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({ size: 1000 }),
}));
const mockExecSync = vi.hoisted(() => vi.fn().mockReturnValue('/usr/bin/ffmpeg'));

// Mock dependencies
vi.mock('../../../db/client.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../../services/ttsClient.js', () => ({
  synthesizeSpeech: mockSynthesizeSpeech,
  createSSMLWithPauses: mockCreateSSMLWithPauses,
  createSSMLSlow: vi.fn(),
}));

vi.mock('../../../services/batchedTTSClient.js', () => ({
  synthesizeBatchedTexts: mockSynthesizeBatchedTexts,
}));

vi.mock('../../../services/audioProcessing.js', () => ({
  normalizeSegmentLoudness: vi.fn((buf: Buffer) => Promise.resolve(buf)),
  applySweeteningChainToBuffer: vi.fn((buf: Buffer) => Promise.resolve(buf)),
}));

vi.mock('../../../services/storageClient.js', () => ({
  uploadAudio: mockUploadAudio,
}));

vi.mock('fluent-ffmpeg', () => ({
  default: mockFfmpeg.ffmpegFn,
}));

vi.mock('fs', () => ({
  promises: mockFs,
}));

vi.mock('child_process', () => ({
  execSync: mockExecSync,
}));

describe('audioGenerator', () => {
  const mockDialogue = {
    id: 'dialogue-123',
    episodeId: 'episode-123',
    sentences: [
      {
        id: 'sentence-1',
        text: 'こんにちは',
        order: 0,
        speaker: {
          id: 'speaker-1',
          voiceId: 'ja-JP-Neural2-B',
        },
      },
      {
        id: 'sentence-2',
        text: 'お元気ですか',
        order: 1,
        speaker: {
          id: 'speaker-2',
          voiceId: 'ja-JP-Neural2-C',
        },
      },
    ],
    speakers: [
      { id: 'speaker-1', voiceId: 'ja-JP-Neural2-B' },
      { id: 'speaker-2', voiceId: 'ja-JP-Neural2-C' },
    ],
  };

  const mockEpisode = {
    id: 'episode-123',
    targetLanguage: 'ja',
    audioUrl: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockPrisma.dialogue.findUnique.mockResolvedValue(mockDialogue);
    mockPrisma.episode.findUnique.mockResolvedValue(mockEpisode);
    mockPrisma.episode.update.mockResolvedValue(mockEpisode);
    mockPrisma.sentence.update.mockResolvedValue({});

    mockSynthesizeSpeech.mockResolvedValue(Buffer.from('audio data'));
    // Mock to return the same number of buffers as texts passed in
    mockSynthesizeBatchedTexts.mockImplementation(async (texts: string[]) =>
      texts.map((_, i) => Buffer.from(`audio ${i}`))
    );
    mockUploadAudio.mockResolvedValue('https://storage.example.com/audio.mp3');
    mockCreateSSMLWithPauses.mockImplementation((text) => `<speak>${text}</speak>`);
  });

  describe('generateEpisodeAudio', () => {
    it('should throw error if dialogue not found', async () => {
      mockPrisma.dialogue.findUnique.mockResolvedValue(null);

      await expect(
        generateEpisodeAudio({
          episodeId: 'episode-123',
          dialogueId: 'nonexistent',
        })
      ).rejects.toThrow('Dialogue not found');
    });

    it('should throw error if episode not found', async () => {
      mockPrisma.episode.findUnique.mockResolvedValue(null);

      await expect(
        generateEpisodeAudio({
          episodeId: 'nonexistent',
          dialogueId: 'dialogue-123',
        })
      ).rejects.toThrow('Episode not found');
    });

    it('should synthesize speech for each sentence', async () => {
      await generateEpisodeAudio({
        episodeId: 'episode-123',
        dialogueId: 'dialogue-123',
      });

      expect(mockSynthesizeSpeech).toHaveBeenCalledTimes(2);
    });

    it('should use correct voice IDs from speakers', async () => {
      await generateEpisodeAudio({
        episodeId: 'episode-123',
        dialogueId: 'dialogue-123',
      });

      const { calls } = mockSynthesizeSpeech.mock;
      expect(calls[0][0].voiceId).toBe('ja-JP-Neural2-B');
      expect(calls[1][0].voiceId).toBe('ja-JP-Neural2-C');
    });

    it('should convert speed preset to numeric value', async () => {
      await generateEpisodeAudio({
        episodeId: 'episode-123',
        dialogueId: 'dialogue-123',
        speed: 'slow',
      });

      const { calls } = mockSynthesizeSpeech.mock;
      expect(calls[0][0].speed).toBe(0.7);
    });

    it('should use medium speed by default (0.85)', async () => {
      await generateEpisodeAudio({
        episodeId: 'episode-123',
        dialogueId: 'dialogue-123',
      });

      const { calls } = mockSynthesizeSpeech.mock;
      expect(calls[0][0].speed).toBe(0.85);
    });

    it('should use normal speed (1.0) when specified', async () => {
      await generateEpisodeAudio({
        episodeId: 'episode-123',
        dialogueId: 'dialogue-123',
        speed: 'normal',
      });

      const { calls } = mockSynthesizeSpeech.mock;
      expect(calls[0][0].speed).toBe(1.0);
    });

    it('should use SSML when pause mode is enabled', async () => {
      await generateEpisodeAudio({
        episodeId: 'episode-123',
        dialogueId: 'dialogue-123',
        pauseMode: true,
      });

      expect(mockCreateSSMLWithPauses).toHaveBeenCalled();
      const { calls } = mockSynthesizeSpeech.mock;
      expect(calls[0][0].useSSML).toBe(true);
    });

    it('should upload audio to storage', async () => {
      await generateEpisodeAudio({
        episodeId: 'episode-123',
        dialogueId: 'dialogue-123',
      });

      expect(mockUploadAudio).toHaveBeenCalled();
    });

    it('should update episode with audio URL', async () => {
      await generateEpisodeAudio({
        episodeId: 'episode-123',
        dialogueId: 'dialogue-123',
      });

      expect(mockPrisma.episode.update).toHaveBeenCalledWith({
        where: { id: 'episode-123' },
        data: expect.objectContaining({
          audioUrl: 'https://storage.example.com/audio.mp3',
        }),
      });
    });

    it('should update sentences with timing information', async () => {
      await generateEpisodeAudio({
        episodeId: 'episode-123',
        dialogueId: 'dialogue-123',
      });

      expect(mockPrisma.sentence.update).toHaveBeenCalledTimes(2);
      expect(mockPrisma.sentence.update).toHaveBeenCalledWith({
        where: { id: 'sentence-1' },
        data: expect.objectContaining({
          startTime: expect.any(Number),
          endTime: expect.any(Number),
        }),
      });
    });

    it('should return audio URL and duration', async () => {
      const result = await generateEpisodeAudio({
        episodeId: 'episode-123',
        dialogueId: 'dialogue-123',
      });

      expect(result).toHaveProperty('audioUrl');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('sentenceTimings');
    });

    it('should use ja-JP language code for Japanese', async () => {
      await generateEpisodeAudio({
        episodeId: 'episode-123',
        dialogueId: 'dialogue-123',
      });

      const { calls } = mockSynthesizeSpeech.mock;
      expect(calls[0][0].languageCode).toBe('ja-JP');
    });
  });

  describe('generateAllSpeedsAudio', () => {
    it('should generate audio at all three speeds', async () => {
      const result = await generateAllSpeedsAudio('episode-123', 'dialogue-123');

      expect(result).toHaveLength(3);
      expect(result.map((r) => r.speed)).toEqual(['slow', 'medium', 'normal']);
    });

    it('should use batched TTS for each speed', async () => {
      await generateAllSpeedsAudio('episode-123', 'dialogue-123');

      // Should be called for each speed (3) times number of voice groups
      expect(mockSynthesizeBatchedTexts).toHaveBeenCalled();
    });

    it('should update episode with all three audio URLs', async () => {
      await generateAllSpeedsAudio('episode-123', 'dialogue-123');

      const updateCalls = mockPrisma.episode.update.mock.calls;
      const fields = updateCalls.flatMap((call) => Object.keys(call[0].data));

      expect(fields).toContain('audioUrl_0_7');
      expect(fields).toContain('audioUrl_0_85');
      expect(fields).toContain('audioUrl_1_0');
    });

    it('should call progress callback with updates', async () => {
      const onProgress = vi.fn();

      await generateAllSpeedsAudio('episode-123', 'dialogue-123', onProgress);

      expect(onProgress).toHaveBeenCalled();
    });

    it('should group sentences by voice ID for batching', async () => {
      // Create dialogue with multiple sentences per voice to demonstrate batching
      mockPrisma.dialogue.findUnique.mockResolvedValue({
        ...mockDialogue,
        sentences: [
          {
            id: 'sentence-1',
            text: 'Hello',
            order: 0,
            speaker: { id: 'speaker-1', voiceId: 'ja-JP-Neural2-B' },
          },
          {
            id: 'sentence-2',
            text: 'World',
            order: 1,
            speaker: { id: 'speaker-1', voiceId: 'ja-JP-Neural2-B' },
          },
          {
            id: 'sentence-3',
            text: 'Test',
            order: 2,
            speaker: { id: 'speaker-1', voiceId: 'ja-JP-Neural2-B' },
          },
        ],
      });

      await generateAllSpeedsAudio('episode-123', 'dialogue-123');

      // With 1 voice and 3 sentences, should have 1 batch call per speed = 3 total
      // (Not 3 sentences * 3 speeds = 9 individual calls)
      const { calls } = mockSynthesizeBatchedTexts.mock;
      expect(calls.length).toBe(3); // 1 voice batch per speed * 3 speeds
    });

    it('should throw error if dialogue not found', async () => {
      mockPrisma.dialogue.findUnique.mockResolvedValue(null);

      await expect(generateAllSpeedsAudio('episode-123', 'nonexistent')).rejects.toThrow(
        'Dialogue not found'
      );
    });

    it('should throw error if episode not found', async () => {
      mockPrisma.episode.findUnique.mockResolvedValue(null);

      await expect(generateAllSpeedsAudio('nonexistent', 'dialogue-123')).rejects.toThrow(
        'Episode not found'
      );
    });
  });

  describe('speed presets', () => {
    it('should map slow to 0.7', async () => {
      await generateEpisodeAudio({
        episodeId: 'episode-123',
        dialogueId: 'dialogue-123',
        speed: 'slow',
      });

      expect(mockSynthesizeSpeech.mock.calls[0][0].speed).toBe(0.7);
    });

    it('should map medium to 0.85', async () => {
      await generateEpisodeAudio({
        episodeId: 'episode-123',
        dialogueId: 'dialogue-123',
        speed: 'medium',
      });

      expect(mockSynthesizeSpeech.mock.calls[0][0].speed).toBe(0.85);
    });

    it('should map normal to 1.0', async () => {
      await generateEpisodeAudio({
        episodeId: 'episode-123',
        dialogueId: 'dialogue-123',
        speed: 'normal',
      });

      expect(mockSynthesizeSpeech.mock.calls[0][0].speed).toBe(1.0);
    });

    it('should default to 1.0 for unknown speed preset', async () => {
      await generateEpisodeAudio({
        episodeId: 'episode-123',
        dialogueId: 'dialogue-123',
        speed: 'unknown' as unknown as 'slow' | 'medium' | 'normal',
      });

      expect(mockSynthesizeSpeech.mock.calls[0][0].speed).toBe(1.0);
    });
  });
});
