import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import after mocking
import '../../../jobs/chunkPackQueue.js';

// Hoisted mocks
const workerProcessors = vi.hoisted(() => new Map<string, (job: unknown) => Promise<unknown>>());
const workerEventHandlers = vi.hoisted(
  () => new Map<string, Map<string, (...args: unknown[]) => void>>()
);
const mockGenerateChunkPack = vi.hoisted(() => vi.fn());
const mockGenerateExampleAudio = vi.hoisted(() => vi.fn());
const mockGenerateStoryAudio = vi.hoisted(() => vi.fn());
const mockGenerateExerciseAudio = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  chunkPack: {
    create: vi.fn(),
    update: vi.fn(),
  },
  chunk: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  chunkExample: {
    create: vi.fn(),
  },
  chunkStory: {
    create: vi.fn(),
  },
  chunkStorySegment: {
    create: vi.fn(),
  },
  chunkExercise: {
    create: vi.fn(),
  },
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

vi.mock('../../../services/chunkPackGenerator.js', () => ({
  generateChunkPack: mockGenerateChunkPack,
}));

vi.mock('../../../services/chunkPackAudioGenerator.js', () => ({
  generateExampleAudio: mockGenerateExampleAudio,
  generateStoryAudio: mockGenerateStoryAudio,
  generateExerciseAudio: mockGenerateExerciseAudio,
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

describe('chunkPackQueue', () => {
  const mockGeneratedPack = {
    title: 'Test Chunk Pack',
    chunks: [
      {
        form: 'てしまう',
        translation: 'completely',
        register: 'casual',
        function: 'completion',
        notes: 'test',
      },
      {
        form: 'ておく',
        translation: 'in advance',
        register: 'neutral',
        function: 'preparation',
        notes: 'test',
      },
    ],
    examples: [
      {
        chunkForm: 'てしまう',
        sentence: '食べてしまった',
        english: 'I ate it all',
        contextNote: 'casual',
      },
      {
        chunkForm: 'ておく',
        sentence: '準備しておく',
        english: 'I will prepare',
        contextNote: 'formal',
      },
    ],
    stories: [
      {
        title: 'Test Story',
        type: 'dialogue',
        storyText: 'Story text',
        english: 'Story translation',
        segments: [
          { japaneseText: 'こんにちは', englishTranslation: 'Hello' },
          { japaneseText: 'さようなら', englishTranslation: 'Goodbye' },
        ],
      },
    ],
    exercises: [
      {
        exerciseType: 'gap_fill_mc',
        prompt: 'Test ___',
        options: ['A', 'B', 'C'],
        correctOption: 'A',
        explanation: 'Test',
      },
    ],
  };

  const mockExampleAudioUrls = new Map([
    [
      '食べてしまった',
      { audioUrl_0_7: 'url-0.7', audioUrl_0_85: 'url-0.85', audioUrl_1_0: 'url-1.0' },
    ],
    [
      '準備しておく',
      { audioUrl_0_7: 'url2-0.7', audioUrl_0_85: 'url2-0.85', audioUrl_1_0: 'url2-1.0' },
    ],
  ]);

  const mockStoryAudio = {
    combinedAudioUrl: 'https://storage.example.com/story.mp3',
    segmentAudioData: [
      { audioUrl: 'seg1.mp3', startTime: 0, endTime: 2 },
      { audioUrl: 'seg2.mp3', startTime: 2, endTime: 4 },
    ],
  };

  const mockExerciseAudioUrls = new Map([['Test ___', 'https://storage.example.com/exercise.mp3']]);

  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateChunkPack.mockResolvedValue(mockGeneratedPack);
    mockGenerateExampleAudio.mockResolvedValue(mockExampleAudioUrls);
    mockGenerateStoryAudio.mockResolvedValue(mockStoryAudio);
    mockGenerateExerciseAudio.mockResolvedValue(mockExerciseAudioUrls);
    mockPrisma.chunkPack.create.mockResolvedValue({ id: 'pack-123' });
    mockPrisma.chunkPack.update.mockResolvedValue({ id: 'pack-123' });
    mockPrisma.chunk.create.mockResolvedValue({ id: 'chunk-123' });
    mockPrisma.chunk.findMany.mockResolvedValue([
      { id: 'chunk-1', form: 'てしまう' },
      { id: 'chunk-2', form: 'ておく' },
    ]);
    mockPrisma.chunkExample.create.mockResolvedValue({ id: 'example-123' });
    mockPrisma.chunkStory.create.mockResolvedValue({ id: 'story-123' });
    mockPrisma.chunkStorySegment.create.mockResolvedValue({ id: 'segment-123' });
    mockPrisma.chunkExercise.create.mockResolvedValue({ id: 'exercise-123' });
  });

  describe('queue setup', () => {
    it('should register worker processor for "chunk-pack-generation" queue', () => {
      const processor = workerProcessors.get('chunk-pack-generation');
      expect(processor).toBeDefined();
      expect(processor).toBeInstanceOf(Function);
    });

    it('should register event handlers for the worker', () => {
      const handlers = workerEventHandlers.get('chunk-pack-generation');
      expect(handlers).toBeDefined();
      expect(handlers?.has('completed')).toBe(true);
      expect(handlers?.has('failed')).toBe(true);
    });
  });

  describe('job processing - happy path', () => {
    it('should call generateChunkPack with jlptLevel and theme', async () => {
      const processor = workerProcessors.get('chunk-pack-generation')!;
      const job = createMockJob({
        data: { userId: 'user-123', jlptLevel: 'N4', theme: 'daily life' },
      });

      await processor(job);

      expect(mockGenerateChunkPack).toHaveBeenCalledWith('N4', 'daily life');
    });

    it('should create ChunkPack record with generating status', async () => {
      const processor = workerProcessors.get('chunk-pack-generation')!;
      const job = createMockJob({
        data: { userId: 'user-123', jlptLevel: 'N4', theme: 'travel' },
      });

      await processor(job);

      expect(mockPrisma.chunkPack.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          title: 'Test Chunk Pack',
          theme: 'travel',
          jlptLevel: 'N4',
          status: 'generating',
        }),
      });
    });

    it('should create Chunk records for each generated chunk', async () => {
      const processor = workerProcessors.get('chunk-pack-generation')!;
      const job = createMockJob({
        data: { userId: 'user-123', jlptLevel: 'N4', theme: 'test' },
      });

      await processor(job);

      expect(mockPrisma.chunk.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.chunk.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          packId: 'pack-123',
          form: 'てしまう',
          translation: 'completely',
        }),
      });
    });

    it('should call generateExampleAudio with examples', async () => {
      const processor = workerProcessors.get('chunk-pack-generation')!;
      const job = createMockJob({
        data: { userId: 'user-123', jlptLevel: 'N4', theme: 'test' },
      });

      await processor(job);

      expect(mockGenerateExampleAudio).toHaveBeenCalledWith('pack-123', mockGeneratedPack.examples);
    });

    it('should create ChunkExample records with audio URLs', async () => {
      const processor = workerProcessors.get('chunk-pack-generation')!;
      const job = createMockJob({
        data: { userId: 'user-123', jlptLevel: 'N4', theme: 'test' },
      });

      await processor(job);

      expect(mockPrisma.chunkExample.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          packId: 'pack-123',
          sentence: '食べてしまった',
          audioUrl_0_85: 'url-0.85',
        }),
      });
    });

    it('should call generateStoryAudio for each story', async () => {
      const processor = workerProcessors.get('chunk-pack-generation')!;
      const job = createMockJob({
        data: { userId: 'user-123', jlptLevel: 'N4', theme: 'test' },
      });

      await processor(job);

      expect(mockGenerateStoryAudio).toHaveBeenCalledWith(
        'pack-123',
        0,
        mockGeneratedPack.stories[0].segments
      );
    });

    it('should create ChunkStory records with combined audio', async () => {
      const processor = workerProcessors.get('chunk-pack-generation')!;
      const job = createMockJob({
        data: { userId: 'user-123', jlptLevel: 'N4', theme: 'test' },
      });

      await processor(job);

      expect(mockPrisma.chunkStory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          packId: 'pack-123',
          title: 'Test Story',
          audioUrl: 'https://storage.example.com/story.mp3',
        }),
      });
    });

    it('should create ChunkStorySegment records with timings', async () => {
      const processor = workerProcessors.get('chunk-pack-generation')!;
      const job = createMockJob({
        data: { userId: 'user-123', jlptLevel: 'N4', theme: 'test' },
      });

      await processor(job);

      expect(mockPrisma.chunkStorySegment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          storyId: 'story-123',
          japaneseText: 'こんにちは',
          startTime: 0,
          endTime: 2,
        }),
      });
    });

    it('should call generateExerciseAudio with exercises', async () => {
      const processor = workerProcessors.get('chunk-pack-generation')!;
      const job = createMockJob({
        data: { userId: 'user-123', jlptLevel: 'N4', theme: 'test' },
      });

      await processor(job);

      expect(mockGenerateExerciseAudio).toHaveBeenCalledWith(
        'pack-123',
        mockGeneratedPack.exercises
      );
    });

    it('should create ChunkExercise records', async () => {
      const processor = workerProcessors.get('chunk-pack-generation')!;
      const job = createMockJob({
        data: { userId: 'user-123', jlptLevel: 'N4', theme: 'test' },
      });

      await processor(job);

      expect(mockPrisma.chunkExercise.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          packId: 'pack-123',
          exerciseType: 'gap_fill_mc',
          prompt: 'Test ___',
        }),
      });
    });

    it('should update pack status to ready on success', async () => {
      const processor = workerProcessors.get('chunk-pack-generation')!;
      const job = createMockJob({
        data: { userId: 'user-123', jlptLevel: 'N4', theme: 'test' },
      });

      await processor(job);

      expect(mockPrisma.chunkPack.update).toHaveBeenCalledWith({
        where: { id: 'pack-123' },
        data: { status: 'ready' },
      });
    });

    it('should update progress throughout generation', async () => {
      const processor = workerProcessors.get('chunk-pack-generation')!;
      const job = createMockJob({
        data: { userId: 'user-123', jlptLevel: 'N4', theme: 'test' },
      });

      await processor(job);

      expect(job.updateProgress).toHaveBeenCalledWith(5);
      expect(job.updateProgress).toHaveBeenCalledWith(20);
      expect(job.updateProgress).toHaveBeenCalledWith(100);
    });

    it('should return packId and status on success', async () => {
      const processor = workerProcessors.get('chunk-pack-generation')!;
      const job = createMockJob({
        data: { userId: 'user-123', jlptLevel: 'N4', theme: 'test' },
      });

      const result = await processor(job);

      expect(result).toEqual({
        packId: 'pack-123',
        status: 'completed',
      });
    });
  });

  describe('job processing - edge cases', () => {
    it('should warn if chunk not found for example', async () => {
      mockPrisma.chunk.findMany.mockResolvedValue([
        { id: 'chunk-1', form: 'てしまう' },
        // Missing 'ておく' chunk
      ]);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const processor = workerProcessors.get('chunk-pack-generation')!;
      const job = createMockJob({
        data: { userId: 'user-123', jlptLevel: 'N4', theme: 'test' },
      });

      await processor(job);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Could not find chunk for example')
      );
      consoleSpy.mockRestore();
    });

    it('should handle empty chunks gracefully', async () => {
      mockGenerateChunkPack.mockResolvedValue({
        ...mockGeneratedPack,
        chunks: [],
        examples: [],
        stories: [],
        exercises: [],
      });

      const processor = workerProcessors.get('chunk-pack-generation')!;
      const job = createMockJob({
        data: { userId: 'user-123', jlptLevel: 'N4', theme: 'test' },
      });

      const result = await processor(job);

      expect(result).toEqual({ packId: 'pack-123', status: 'completed' });
      expect(mockPrisma.chunk.create).not.toHaveBeenCalled();
    });
  });

  describe('job processing - error cases', () => {
    it('should update pack status to error on failure', async () => {
      mockGenerateChunkPack.mockRejectedValue(new Error('Generation failed'));

      const processor = workerProcessors.get('chunk-pack-generation')!;
      const job = createMockJob({
        data: { userId: 'user-123', jlptLevel: 'N4', theme: 'test' },
      });

      const result = await processor(job);

      expect(result).toEqual({
        packId: '',
        status: 'error',
        error: 'Generation failed',
      });
    });

    it('should update existing pack to error if pack was created', async () => {
      mockGenerateExampleAudio.mockRejectedValue(new Error('Audio generation failed'));

      const processor = workerProcessors.get('chunk-pack-generation')!;
      const job = createMockJob({
        data: { userId: 'user-123', jlptLevel: 'N4', theme: 'test' },
      });

      await processor(job);

      expect(mockPrisma.chunkPack.update).toHaveBeenCalledWith({
        where: { id: 'pack-123' },
        data: { status: 'error' },
      });
    });

    it('should return error message on failure', async () => {
      mockGenerateStoryAudio.mockRejectedValue(new Error('Story audio failed'));

      const processor = workerProcessors.get('chunk-pack-generation')!;
      const job = createMockJob({
        data: { userId: 'user-123', jlptLevel: 'N4', theme: 'test' },
      });

      const result = await processor(job);

      expect(result).toEqual(
        expect.objectContaining({
          status: 'error',
          error: 'Story audio failed',
        })
      );
    });

    it('should log error on failure', async () => {
      mockGenerateChunkPack.mockRejectedValue(new Error('API error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const processor = workerProcessors.get('chunk-pack-generation')!;
      const job = createMockJob({
        data: { userId: 'user-123', jlptLevel: 'N4', theme: 'test' },
      });

      await processor(job);

      expect(consoleSpy).toHaveBeenCalledWith('Error generating chunk pack:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('event handlers', () => {
    it('should log on completed event', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      triggerWorkerEvent('chunk-pack-generation', 'completed', { id: 'job-123' });

      expect(consoleSpy).toHaveBeenCalledWith('Chunk pack job job-123 completed');
      consoleSpy.mockRestore();
    });

    it('should log error on failed event', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      triggerWorkerEvent(
        'chunk-pack-generation',
        'failed',
        { id: 'job-456' },
        new Error('Test error')
      );

      expect(consoleSpy).toHaveBeenCalledWith('Chunk pack job job-456 failed:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });
});
