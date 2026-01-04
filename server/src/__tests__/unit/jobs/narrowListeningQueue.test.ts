import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import after mocking
import '../../../jobs/narrowListeningQueue.js';

// Hoisted mocks
const workerProcessors = vi.hoisted(() => new Map<string, (job: unknown) => Promise<unknown>>());
const workerEventHandlers = vi.hoisted(
  () => new Map<string, Map<string, (...args: unknown[]) => void>>()
);
const mockGenerateNarrowListeningPack = vi.hoisted(() => vi.fn());
const mockGenerateNarrowListeningAudio = vi.hoisted(() => vi.fn());
const mockAssignVoicesToSegments = vi.hoisted(() => vi.fn());
const mockProcessJapaneseBatch = vi.hoisted(() => vi.fn());
const mockProcessChineseBatch = vi.hoisted(() => vi.fn());
const mockGenerateSilence = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  narrowListeningPack: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  storyVersion: {
    create: vi.fn(),
    update: vi.fn(),
  },
  storySegment: {
    createMany: vi.fn(),
    update: vi.fn(),
  },
}));

// Mock fs promises
const mockFs = vi.hoisted(() => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  rm: vi.fn(),
}));

// Mock BullMQ
vi.mock('bullmq', () => ({
  Queue: class MockQueue {
    name: string;

    constructor(name: string) {
      this.name = name;
    }

    add = vi.fn();

    close = vi.fn();
  },
  Worker: class MockWorker {
    name: string;

    private eventHandlers = new Map<string, (...args: unknown[]) => void>();

    constructor(name: string, processor: (job: unknown) => Promise<unknown>) {
      this.name = name;
      workerProcessors.set(name, processor);
      workerEventHandlers.set(name, this.eventHandlers);
    }

    on(event: string, handler: (...args: unknown[]) => void): this {
      this.eventHandlers.set(event, handler);
      return this;
    }

    close = vi.fn();
  },
}));

// Mock dependencies
vi.mock('../../../config/redis.js', () => ({
  createRedisConnection: vi.fn(() => ({})),
  defaultWorkerSettings: { concurrency: 1 },
}));

vi.mock('../../../db/client.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../../services/narrowListeningGenerator.js', () => ({
  generateNarrowListeningPack: mockGenerateNarrowListeningPack,
}));

vi.mock('../../../services/narrowListeningAudioGenerator.js', () => ({
  generateNarrowListeningAudio: mockGenerateNarrowListeningAudio,
  assignVoicesToSegments: mockAssignVoicesToSegments,
}));

vi.mock('../../../services/languageProcessor.js', () => ({
  processJapaneseBatch: mockProcessJapaneseBatch,
  processChineseBatch: mockProcessChineseBatch,
}));

vi.mock('../../../services/ttsClient.js', () => ({
  generateSilence: mockGenerateSilence,
}));

vi.mock('../../../../shared/src/constants-new.js', () => ({
  TTS_VOICES: {
    ja: {
      voices: [
        { id: 'ja-JP-Neural2-B', gender: 'male', description: 'Male 1' },
        { id: 'ja-JP-Neural2-C', gender: 'female', description: 'Female 1' },
      ],
    },
    zh: {
      voices: [
        { id: 'zh-CN-Neural2-A', gender: 'male', description: 'Male 1' },
        { id: 'zh-CN-Neural2-B', gender: 'female', description: 'Female 1' },
      ],
    },
  },
}));

vi.mock('fs', () => ({
  promises: mockFs,
}));

// Helper to create mock job
const createMockJob = (
  overrides: Partial<{
    id: string;
    name: string;
    data: Record<string, unknown>;
    updateProgress: ReturnType<typeof vi.fn>;
  }> = {}
) => ({
  id: 'test-job-123',
  name: 'default',
  data: {},
  updateProgress: vi.fn(),
  ...overrides,
});

// Helper to trigger event handlers
const triggerWorkerEvent = (queueName: string, event: string, ...args: unknown[]): void => {
  const handlers = workerEventHandlers.get(queueName);
  const handler = handlers?.get(event);
  if (handler) {
    handler(...args);
  }
};

describe('narrowListeningQueue', () => {
  const mockStoryPack = {
    title: 'Test Story Pack',
    versions: [
      {
        variationType: 'original',
        title: 'Version 1',
        segments: [
          { targetText: 'こんにちは', englishTranslation: 'Hello' },
          { targetText: 'さようなら', englishTranslation: 'Goodbye' },
        ],
      },
    ],
  };

  const mockAudioResult = {
    combinedAudioUrl: 'https://storage.example.com/audio.mp3',
    segments: [
      {
        text: 'こんにちは',
        translation: 'Hello',
        reading: 'こんにちは',
        startTime: 0,
        endTime: 1,
        voiceId: 'ja-JP-Neural2-B',
        audioUrl: 'seg1.mp3',
      },
      {
        text: 'さようなら',
        translation: 'Goodbye',
        reading: 'さようなら',
        startTime: 1,
        endTime: 2,
        voiceId: 'ja-JP-Neural2-C',
        audioUrl: 'seg2.mp3',
      },
    ],
  };

  const mockPackWithVersions = {
    id: 'pack-123',
    targetLanguage: 'ja',
    versions: [
      {
        id: 'version-1',
        order: 0,
        voiceId: 'ja-JP-Neural2-B',
        audioUrl_0_7: null,
        audioUrl_0_85: 'existing-0.85.mp3',
        audioUrl_1_0: null,
        segments: [
          {
            id: 'seg-1',
            targetText: 'こんにちは',
            englishTranslation: 'Hello',
            voiceId: 'ja-JP-Neural2-B',
            reading: 'こんにちは',
          },
          {
            id: 'seg-2',
            targetText: 'さようなら',
            englishTranslation: 'Goodbye',
            voiceId: 'ja-JP-Neural2-C',
            reading: 'さようなら',
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateNarrowListeningPack.mockResolvedValue(mockStoryPack);
    mockGenerateNarrowListeningAudio.mockResolvedValue(mockAudioResult);
    mockAssignVoicesToSegments.mockReturnValue(['ja-JP-Neural2-B', 'ja-JP-Neural2-C']);
    mockProcessJapaneseBatch.mockResolvedValue([
      { furigana: 'こんにちは' },
      { furigana: 'さようなら' },
    ]);
    mockProcessChineseBatch.mockResolvedValue([
      { pinyinToneMarks: 'nǐ hǎo' },
      { pinyinToneMarks: 'zài jiàn' },
    ]);
    mockGenerateSilence.mockResolvedValue(Buffer.from('silence'));
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.rm.mockResolvedValue(undefined);
    mockPrisma.narrowListeningPack.update.mockResolvedValue({ id: 'pack-123' });
    mockPrisma.narrowListeningPack.findUnique.mockResolvedValue(mockPackWithVersions);
    mockPrisma.storyVersion.create.mockResolvedValue({ id: 'version-123' });
    mockPrisma.storyVersion.update.mockResolvedValue({ id: 'version-123' });
    mockPrisma.storySegment.createMany.mockResolvedValue({ count: 2 });
    mockPrisma.storySegment.update.mockResolvedValue({ id: 'seg-123' });
  });

  describe('queue setup', () => {
    it('should register worker processor for "narrow-listening-generation" queue', () => {
      const processor = workerProcessors.get('narrow-listening-generation');
      expect(processor).toBeDefined();
      expect(processor).toBeInstanceOf(Function);
    });

    it('should register event handlers for the worker', () => {
      const handlers = workerEventHandlers.get('narrow-listening-generation');
      expect(handlers).toBeDefined();
      expect(handlers?.has('completed')).toBe(true);
      expect(handlers?.has('failed')).toBe(true);
    });
  });

  describe('generate-narrow-listening job type', () => {
    it('should update pack status to generating', async () => {
      const processor = workerProcessors.get('narrow-listening-generation')!;
      const job = createMockJob({
        name: 'generate-narrow-listening',
        data: {
          packId: 'pack-123',
          topic: 'daily life',
          targetLanguage: 'ja',
          proficiencyLevel: 'intermediate',
          versionCount: 1,
        },
      });

      await processor(job);

      expect(mockPrisma.narrowListeningPack.update).toHaveBeenCalledWith({
        where: { id: 'pack-123' },
        data: { status: 'generating' },
      });
    });

    it('should call generateNarrowListeningPack with params', async () => {
      const processor = workerProcessors.get('narrow-listening-generation')!;
      const job = createMockJob({
        name: 'generate-narrow-listening',
        data: {
          packId: 'pack-123',
          topic: 'travel',
          targetLanguage: 'ja',
          proficiencyLevel: 'beginner',
          versionCount: 2,
          grammarFocus: 'te-form',
        },
      });

      await processor(job);

      expect(mockGenerateNarrowListeningPack).toHaveBeenCalledWith(
        'travel',
        'ja',
        'beginner',
        2,
        'te-form'
      );
    });

    it('should update pack title from generated story', async () => {
      const processor = workerProcessors.get('narrow-listening-generation')!;
      const job = createMockJob({
        name: 'generate-narrow-listening',
        data: {
          packId: 'pack-123',
          topic: 'test',
          targetLanguage: 'ja',
          proficiencyLevel: 'intermediate',
          versionCount: 1,
        },
      });

      await processor(job);

      expect(mockPrisma.narrowListeningPack.update).toHaveBeenCalledWith({
        where: { id: 'pack-123' },
        data: { title: 'Test Story Pack' },
      });
    });

    it('should generate shared silence buffer', async () => {
      const processor = workerProcessors.get('narrow-listening-generation')!;
      const job = createMockJob({
        name: 'generate-narrow-listening',
        data: {
          packId: 'pack-123',
          topic: 'test',
          targetLanguage: 'ja',
          proficiencyLevel: 'intermediate',
          versionCount: 1,
        },
      });

      await processor(job);

      expect(mockGenerateSilence).toHaveBeenCalledWith(2.0);
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should call assignVoicesToSegments for each version', async () => {
      const processor = workerProcessors.get('narrow-listening-generation')!;
      const job = createMockJob({
        name: 'generate-narrow-listening',
        data: {
          packId: 'pack-123',
          topic: 'test',
          targetLanguage: 'ja',
          proficiencyLevel: 'intermediate',
          versionCount: 1,
        },
      });

      await processor(job);

      expect(mockAssignVoicesToSegments).toHaveBeenCalledWith(
        2, // segments.length
        expect.arrayContaining([expect.objectContaining({ id: expect.any(String) })])
      );
    });

    it('should batch process Japanese furigana', async () => {
      const processor = workerProcessors.get('narrow-listening-generation')!;
      const job = createMockJob({
        name: 'generate-narrow-listening',
        data: {
          packId: 'pack-123',
          topic: 'test',
          targetLanguage: 'ja',
          proficiencyLevel: 'intermediate',
          versionCount: 1,
        },
      });

      await processor(job);

      expect(mockProcessJapaneseBatch).toHaveBeenCalledWith(['こんにちは', 'さようなら']);
    });

    it('should batch process Chinese pinyin', async () => {
      mockGenerateNarrowListeningPack.mockResolvedValue({
        ...mockStoryPack,
        versions: [
          {
            ...mockStoryPack.versions[0],
            segments: [{ targetText: '你好', englishTranslation: 'Hello' }],
          },
        ],
      });

      const processor = workerProcessors.get('narrow-listening-generation')!;
      const job = createMockJob({
        name: 'generate-narrow-listening',
        data: {
          packId: 'pack-123',
          topic: 'test',
          targetLanguage: 'zh',
          proficiencyLevel: 'intermediate',
          versionCount: 1,
        },
      });

      await processor(job);

      expect(mockProcessChineseBatch).toHaveBeenCalledWith(['你好']);
    });

    it('should generate audio at 0.7x, 0.85x, and 1.0x speeds', async () => {
      const processor = workerProcessors.get('narrow-listening-generation')!;
      const job = createMockJob({
        name: 'generate-narrow-listening',
        data: {
          packId: 'pack-123',
          topic: 'test',
          targetLanguage: 'ja',
          proficiencyLevel: 'intermediate',
          versionCount: 1,
        },
      });

      await processor(job);

      expect(mockGenerateNarrowListeningAudio).toHaveBeenCalledTimes(3);
      expect(mockGenerateNarrowListeningAudio).toHaveBeenCalledWith(
        'pack-123',
        expect.any(Array),
        expect.any(Array),
        0.7,
        0,
        'ja',
        expect.any(String)
      );
      expect(mockGenerateNarrowListeningAudio).toHaveBeenCalledWith(
        'pack-123',
        expect.any(Array),
        expect.any(Array),
        0.85,
        0,
        'ja',
        expect.any(String)
      );
      expect(mockGenerateNarrowListeningAudio).toHaveBeenCalledWith(
        'pack-123',
        expect.any(Array),
        expect.any(Array),
        1.0,
        0,
        'ja',
        expect.any(String)
      );
    });

    it('should create StoryVersion records', async () => {
      const processor = workerProcessors.get('narrow-listening-generation')!;
      const job = createMockJob({
        name: 'generate-narrow-listening',
        data: {
          packId: 'pack-123',
          topic: 'test',
          targetLanguage: 'ja',
          proficiencyLevel: 'intermediate',
          versionCount: 1,
        },
      });

      await processor(job);

      expect(mockPrisma.storyVersion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          packId: 'pack-123',
          variationType: 'original',
          title: 'Version 1',
          voiceId: 'ja-JP-Neural2-B',
        }),
      });
    });

    it('should create StorySegment records with timings', async () => {
      const processor = workerProcessors.get('narrow-listening-generation')!;
      const job = createMockJob({
        name: 'generate-narrow-listening',
        data: {
          packId: 'pack-123',
          topic: 'test',
          targetLanguage: 'ja',
          proficiencyLevel: 'intermediate',
          versionCount: 1,
        },
      });

      await processor(job);

      expect(mockPrisma.storySegment.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            targetText: 'こんにちは',
            startTime_0_85: 0,
            endTime_0_85: 1,
          }),
        ]),
      });
    });

    it('should update pack status to ready on success', async () => {
      const processor = workerProcessors.get('narrow-listening-generation')!;
      const job = createMockJob({
        name: 'generate-narrow-listening',
        data: {
          packId: 'pack-123',
          topic: 'test',
          targetLanguage: 'ja',
          proficiencyLevel: 'intermediate',
          versionCount: 1,
        },
      });

      await processor(job);

      expect(mockPrisma.narrowListeningPack.update).toHaveBeenCalledWith({
        where: { id: 'pack-123' },
        data: { status: 'ready' },
      });
    });

    it('should cleanup silence temp directory', async () => {
      const processor = workerProcessors.get('narrow-listening-generation')!;
      const job = createMockJob({
        name: 'generate-narrow-listening',
        data: {
          packId: 'pack-123',
          topic: 'test',
          targetLanguage: 'ja',
          proficiencyLevel: 'intermediate',
          versionCount: 1,
        },
      });

      await processor(job);

      expect(mockFs.rm).toHaveBeenCalledWith(expect.stringContaining('nl-silence'), {
        recursive: true,
        force: true,
      });
    });

    it('should update pack status to error on failure', async () => {
      mockGenerateNarrowListeningPack.mockRejectedValue(new Error('Generation failed'));

      const processor = workerProcessors.get('narrow-listening-generation')!;
      const job = createMockJob({
        name: 'generate-narrow-listening',
        data: {
          packId: 'pack-123',
          topic: 'test',
          targetLanguage: 'ja',
          proficiencyLevel: 'intermediate',
          versionCount: 1,
        },
      });

      await expect(processor(job)).rejects.toThrow('Generation failed');

      expect(mockPrisma.narrowListeningPack.update).toHaveBeenCalledWith({
        where: { id: 'pack-123' },
        data: { status: 'error' },
      });
    });
  });

  describe('generate-speed job type', () => {
    it('should validate speed is 0.7, 0.85, or 1.0', async () => {
      const processor = workerProcessors.get('narrow-listening-generation')!;
      const job = createMockJob({
        name: 'generate-speed',
        data: { packId: 'pack-123', speed: 0.5 },
      });

      await expect(processor(job)).rejects.toThrow('Invalid speed: 0.5');
    });

    it('should skip versions with existing audio for requested speed', async () => {
      // Version already has 0.85 audio
      const processor = workerProcessors.get('narrow-listening-generation')!;
      const job = createMockJob({
        name: 'generate-speed',
        data: { packId: 'pack-123', speed: 0.85 },
      });

      await processor(job);

      // Should not generate new audio for 0.85 since it exists
      expect(mockGenerateNarrowListeningAudio).not.toHaveBeenCalled();
    });

    it('should generate audio for missing speed', async () => {
      const processor = workerProcessors.get('narrow-listening-generation')!;
      const job = createMockJob({
        name: 'generate-speed',
        data: { packId: 'pack-123', speed: 0.7 },
      });

      await processor(job);

      expect(mockGenerateNarrowListeningAudio).toHaveBeenCalledWith(
        'pack-123',
        expect.any(Array),
        expect.any(Array),
        0.7,
        0,
        'ja',
        expect.any(String)
      );
    });

    it('should update version audioUrl field', async () => {
      const processor = workerProcessors.get('narrow-listening-generation')!;
      const job = createMockJob({
        name: 'generate-speed',
        data: { packId: 'pack-123', speed: 0.7 },
      });

      await processor(job);

      expect(mockPrisma.storyVersion.update).toHaveBeenCalledWith({
        where: { id: 'version-1' },
        data: { audioUrl_0_7: 'https://storage.example.com/audio.mp3' },
      });
    });

    it('should update segment timing data', async () => {
      const processor = workerProcessors.get('narrow-listening-generation')!;
      const job = createMockJob({
        name: 'generate-speed',
        data: { packId: 'pack-123', speed: 0.7 },
      });

      await processor(job);

      expect(mockPrisma.storySegment.update).toHaveBeenCalledWith({
        where: { id: 'seg-1' },
        data: expect.objectContaining({
          startTime_0_7: 0,
          endTime_0_7: 1,
        }),
      });
    });

    it('should backfill voiceId if missing', async () => {
      // Mock audio result to match single segment
      mockGenerateNarrowListeningAudio.mockResolvedValue({
        combinedAudioUrl: 'https://storage.example.com/audio.mp3',
        segments: [
          {
            text: 'こんにちは',
            translation: 'Hello',
            reading: 'こんにちは',
            startTime: 0,
            endTime: 1,
            voiceId: 'ja-JP-Neural2-B',
            audioUrl: 'seg1.mp3',
          },
        ],
      });

      mockPrisma.narrowListeningPack.findUnique.mockResolvedValue({
        ...mockPackWithVersions,
        versions: [
          {
            ...mockPackWithVersions.versions[0],
            audioUrl_0_7: null, // Must be null to trigger generation
            segments: [
              {
                id: 'seg-1',
                targetText: 'こんにちは',
                englishTranslation: 'Hello',
                voiceId: null,
                reading: null,
              },
            ],
          },
        ],
      });

      const processor = workerProcessors.get('narrow-listening-generation')!;
      const job = createMockJob({
        name: 'generate-speed',
        data: { packId: 'pack-123', speed: 0.7 },
      });

      await processor(job);

      expect(mockPrisma.storySegment.update).toHaveBeenCalledWith({
        where: { id: 'seg-1' },
        data: expect.objectContaining({
          voiceId: 'ja-JP-Neural2-B',
        }),
      });
    });

    it('should cleanup temp directory on on-demand generation', async () => {
      const processor = workerProcessors.get('narrow-listening-generation')!;
      const job = createMockJob({
        name: 'generate-speed',
        data: { packId: 'pack-123', speed: 0.7 },
      });

      await processor(job);

      expect(mockFs.rm).toHaveBeenCalledWith(expect.stringContaining('nl-silence-ondemand'), {
        recursive: true,
        force: true,
      });
    });

    it('should throw error for pack not found', async () => {
      mockPrisma.narrowListeningPack.findUnique.mockResolvedValue(null);

      const processor = workerProcessors.get('narrow-listening-generation')!;
      const job = createMockJob({
        name: 'generate-speed',
        data: { packId: 'nonexistent', speed: 0.7 },
      });

      await expect(processor(job)).rejects.toThrow('Pack not found');
    });
  });

  describe('unknown job type', () => {
    it('should throw error for unknown job type', async () => {
      const processor = workerProcessors.get('narrow-listening-generation')!;
      const job = createMockJob({
        name: 'unknown-type',
        data: { packId: 'pack-123' },
      });

      await expect(processor(job)).rejects.toThrow('Unknown job type: unknown-type');
    });
  });

  describe('event handlers', () => {
    it('should log on completed event', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      triggerWorkerEvent('narrow-listening-generation', 'completed', { id: 'job-123' });

      expect(consoleSpy).toHaveBeenCalledWith('✅ Job job-123 completed');
      consoleSpy.mockRestore();
    });

    it('should log error on failed event', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      triggerWorkerEvent(
        'narrow-listening-generation',
        'failed',
        { id: 'job-456' },
        new Error('Test error')
      );

      expect(consoleSpy).toHaveBeenCalledWith('❌ Job job-456 failed:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });
});
