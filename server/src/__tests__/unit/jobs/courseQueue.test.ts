import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import after mocking
import '../../../jobs/courseQueue.js';

// Hoisted mocks for capturing worker processor and events
const workerProcessors = vi.hoisted(() => new Map<string, (job: unknown) => Promise<unknown>>());
const workerEventHandlers = vi.hoisted(
  () => new Map<string, Map<string, (...args: unknown[]) => void>>()
);
const mockExtractDialogueExchangesFromSourceText = vi.hoisted(() => vi.fn());
const mockGenerateConversationalLessonScript = vi.hoisted(() => vi.fn());
const mockAssembleLessonAudio = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  course: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  courseCoreItem: {
    createMany: vi.fn(),
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

    getJob = vi.fn();

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

// Mock Redis config
vi.mock('../../../config/redis.js', () => ({
  createRedisConnection: vi.fn(() => ({})),
  defaultWorkerSettings: { concurrency: 1 },
}));

// Mock Prisma
vi.mock('../../../db/client.js', () => ({
  prisma: mockPrisma,
}));

// Mock course services
vi.mock('../../../services/courseItemExtractor.js', () => ({
  extractCoreItems: vi.fn(),
  extractDialogueExchanges: vi.fn(),
  extractDialogueExchangesFromSourceText: mockExtractDialogueExchangesFromSourceText,
}));

vi.mock('../../../services/lessonPlanner.js', () => ({
  planCourse: vi.fn(),
}));

vi.mock('../../../services/lessonScriptGenerator.js', () => ({
  generateLessonScript: vi.fn(),
}));

vi.mock('../../../services/conversationalLessonScriptGenerator.js', () => ({
  generateConversationalLessonScript: mockGenerateConversationalLessonScript,
}));

vi.mock('../../../services/audioCourseAssembler.js', () => ({
  assembleLessonAudio: mockAssembleLessonAudio,
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

describe('courseQueue', () => {
  const mockCourse = {
    id: 'course-123',
    status: 'pending',
    targetLanguage: 'ja',
    nativeLanguage: 'en',
    maxLessonDurationMinutes: 15,
    jlptLevel: 'N4',
    l1VoiceId: 'en-US-Neural2-D',
    speaker1Gender: 'male',
    speaker2Gender: 'female',
    speaker1VoiceId: 'ja-JP-Neural2-B',
    speaker2VoiceId: 'ja-JP-Neural2-C',
    scriptJson: null,
    audioUrl: null,
    courseEpisodes: [
      {
        order: 0,
        episode: {
          id: 'episode-456',
          title: 'Test Episode',
          sourceText: 'Two friends discussing weekend plans',
          dialogue: {
            speakers: [
              { name: 'Tanaka', voiceId: 'ja-JP-Neural2-B' },
              { name: 'Yamada', voiceId: 'ja-JP-Neural2-C' },
            ],
          },
        },
      },
    ],
  };

  const mockDialogueExchanges = [
    {
      speakerName: 'Tanaka',
      speakerVoiceId: 'ja-JP-Neural2-B',
      textL2: 'こんにちは',
      translationL1: 'Hello',
      vocabularyItems: [{ textL2: 'こんにちは', readingL2: 'こんにちは', translationL1: 'hello' }],
    },
    {
      speakerName: 'Yamada',
      speakerVoiceId: 'ja-JP-Neural2-C',
      textL2: 'お元気ですか',
      translationL1: 'How are you?',
      vocabularyItems: [{ textL2: '元気', readingL2: 'げんき', translationL1: 'health/energy' }],
    },
  ];

  const mockGeneratedScript = {
    units: [
      { type: 'intro', text: 'Welcome to the lesson' },
      { type: 'dialogue', speaker: 'Tanaka', text: 'こんにちは' },
      { type: 'dialogue', speaker: 'Yamada', text: 'お元気ですか' },
    ],
    estimatedDurationSeconds: 120,
  };

  const mockAssembledAudio = {
    audioUrl: 'https://storage.example.com/course-audio.mp3',
    actualDurationSeconds: 125,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.course.findUnique.mockResolvedValue(mockCourse);
    mockPrisma.course.update.mockResolvedValue(mockCourse);
    mockPrisma.courseCoreItem.createMany.mockResolvedValue({ count: 2 });
    mockExtractDialogueExchangesFromSourceText.mockResolvedValue(mockDialogueExchanges);
    mockGenerateConversationalLessonScript.mockResolvedValue(mockGeneratedScript);
    mockAssembleLessonAudio.mockResolvedValue(mockAssembledAudio);
  });

  describe('queue setup', () => {
    it('should register worker processor for "course-generation" queue', () => {
      const processor = workerProcessors.get('course-generation');
      expect(processor).toBeDefined();
      expect(processor).toBeInstanceOf(Function);
    });

    it('should register event handlers for the worker', () => {
      const handlers = workerEventHandlers.get('course-generation');
      expect(handlers).toBeDefined();
      expect(handlers?.has('completed')).toBe(true);
      expect(handlers?.has('failed')).toBe(true);
      expect(handlers?.has('progress')).toBe(true);
    });
  });

  describe('job processing - happy path', () => {
    it('should update course status to generating at start', async () => {
      const processor = workerProcessors.get('course-generation')!;
      const job = createMockJob({ data: { courseId: 'course-123' } });

      await processor(job);

      expect(mockPrisma.course.update).toHaveBeenCalledWith({
        where: { id: 'course-123' },
        data: { status: 'generating' },
      });
    });

    it('should fetch course with episodes and dialogue', async () => {
      const processor = workerProcessors.get('course-generation')!;
      const job = createMockJob({ data: { courseId: 'course-123' } });

      await processor(job);

      expect(mockPrisma.course.findUnique).toHaveBeenCalledWith({
        where: { id: 'course-123' },
        include: expect.objectContaining({
          courseEpisodes: expect.objectContaining({
            include: expect.objectContaining({
              episode: expect.any(Object),
            }),
          }),
        }),
      });
    });

    it('should extract dialogue exchanges from source text', async () => {
      const processor = workerProcessors.get('course-generation')!;
      const job = createMockJob({ data: { courseId: 'course-123' } });

      await processor(job);

      expect(mockExtractDialogueExchangesFromSourceText).toHaveBeenCalledWith(
        'Two friends discussing weekend plans',
        'Test Episode',
        'ja',
        'en',
        15,
        'N4',
        expect.any(Array),
        'male',
        'female',
        'ja-JP-Neural2-B',
        'ja-JP-Neural2-C'
      );
    });

    it('should create courseCoreItem records for vocabulary', async () => {
      const processor = workerProcessors.get('course-generation')!;
      const job = createMockJob({ data: { courseId: 'course-123' } });

      await processor(job);

      expect(mockPrisma.courseCoreItem.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            courseId: 'course-123',
            textL2: 'こんにちは',
            translationL1: 'hello',
          }),
        ]),
      });
    });

    it('should generate conversational lesson script', async () => {
      const processor = workerProcessors.get('course-generation')!;
      const job = createMockJob({ data: { courseId: 'course-123' } });

      await processor(job);

      expect(mockGenerateConversationalLessonScript).toHaveBeenCalledWith(
        mockDialogueExchanges,
        expect.objectContaining({
          episodeTitle: 'Test Episode',
          targetLanguage: 'ja',
          nativeLanguage: 'en',
          l1VoiceId: 'en-US-Neural2-D',
          jlptLevel: 'N4',
        })
      );
    });

    it('should assemble lesson audio', async () => {
      const processor = workerProcessors.get('course-generation')!;
      const job = createMockJob({ data: { courseId: 'course-123' } });

      await processor(job);

      expect(mockAssembleLessonAudio).toHaveBeenCalledWith(
        expect.objectContaining({
          lessonId: 'course-123',
          scriptUnits: mockGeneratedScript.units,
          targetLanguage: 'ja',
          nativeLanguage: 'en',
        })
      );
    });

    it('should update course with audioUrl and duration on success', async () => {
      const processor = workerProcessors.get('course-generation')!;
      const job = createMockJob({ data: { courseId: 'course-123' } });

      await processor(job);

      expect(mockPrisma.course.update).toHaveBeenCalledWith({
        where: { id: 'course-123' },
        data: expect.objectContaining({
          audioUrl: 'https://storage.example.com/course-audio.mp3',
          approxDurationSeconds: 125,
          status: 'ready',
        }),
      });
    });

    it('should update progress throughout generation', async () => {
      const processor = workerProcessors.get('course-generation')!;
      const job = createMockJob({ data: { courseId: 'course-123' } });

      await processor(job);

      expect(job.updateProgress).toHaveBeenCalledWith(5);
      expect(job.updateProgress).toHaveBeenCalledWith(10);
      expect(job.updateProgress).toHaveBeenCalledWith(20);
      expect(job.updateProgress).toHaveBeenCalledWith(100);
    });

    it('should update progress during audio assembly', async () => {
      // Mock assembleLessonAudio to invoke the onProgress callback
      mockAssembleLessonAudio.mockImplementation(async (options: any) => {
        // Simulate progress callbacks during audio assembly
        if (options.onProgress) {
          options.onProgress(1, 4); // Should update to 60 + (1/4 * 25) = 66
          options.onProgress(2, 4); // Should update to 60 + (2/4 * 25) = 72
          options.onProgress(3, 4); // Should update to 60 + (3/4 * 25) = 78
          options.onProgress(4, 4); // Should update to 60 + (4/4 * 25) = 85
        }
        return mockAssembledAudio;
      });

      const processor = workerProcessors.get('course-generation')!;
      const job = createMockJob({ data: { courseId: 'course-123' } });

      await processor(job);

      // Verify audio assembly progress updates were called
      expect(job.updateProgress).toHaveBeenCalledWith(66);
      expect(job.updateProgress).toHaveBeenCalledWith(72);
      expect(job.updateProgress).toHaveBeenCalledWith(78);
      expect(job.updateProgress).toHaveBeenCalledWith(85);
    });

    it('should return result with course details', async () => {
      const processor = workerProcessors.get('course-generation')!;
      const job = createMockJob({ data: { courseId: 'course-123' } });

      const result = await processor(job);

      expect(result).toEqual({
        courseId: 'course-123',
        lessonCount: 1,
        vocabularyItemCount: 2,
        exchangeCount: 2,
      });
    });
  });

  describe('job processing - edge cases', () => {
    it('should skip generation if course already has scriptJson and audioUrl', async () => {
      mockPrisma.course.findUnique.mockResolvedValue({
        ...mockCourse,
        scriptJson: [{ type: 'existing' }],
        audioUrl: 'https://existing.mp3',
      });

      const processor = workerProcessors.get('course-generation')!;
      const job = createMockJob({ data: { courseId: 'course-123' } });

      const result = await processor(job);

      expect(mockGenerateConversationalLessonScript).not.toHaveBeenCalled();
      expect(mockAssembleLessonAudio).not.toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({
          courseId: 'course-123',
          vocabularyItemCount: 0,
        })
      );
    });

    it('should handle course with no vocabulary items', async () => {
      mockExtractDialogueExchangesFromSourceText.mockResolvedValue([
        {
          speakerName: 'Tanaka',
          speakerVoiceId: 'ja-JP-Neural2-B',
          textL2: 'こんにちは',
          translationL1: 'Hello',
          vocabularyItems: [],
        },
      ]);

      const processor = workerProcessors.get('course-generation')!;
      const job = createMockJob({ data: { courseId: 'course-123' } });

      await processor(job);

      expect(mockPrisma.courseCoreItem.createMany).not.toHaveBeenCalled();
    });

    it('should handle JLPT level being null', async () => {
      mockPrisma.course.findUnique.mockResolvedValue({
        ...mockCourse,
        jlptLevel: null,
      });

      const processor = workerProcessors.get('course-generation')!;
      const job = createMockJob({ data: { courseId: 'course-123' } });

      await processor(job);

      expect(mockExtractDialogueExchangesFromSourceText).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        undefined, // JLPT level should be undefined
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });
  });

  describe('job processing - error cases', () => {
    it('should throw error if course not found', async () => {
      mockPrisma.course.findUnique.mockResolvedValue(null);

      const processor = workerProcessors.get('course-generation')!;
      const job = createMockJob({ data: { courseId: 'nonexistent' } });

      await expect(processor(job)).rejects.toThrow('Course not found');
    });

    it('should throw error if course has no episodes', async () => {
      mockPrisma.course.findUnique.mockResolvedValue({
        ...mockCourse,
        courseEpisodes: [],
      });

      const processor = workerProcessors.get('course-generation')!;
      const job = createMockJob({ data: { courseId: 'course-123' } });

      await expect(processor(job)).rejects.toThrow('Course has no episodes');
    });

    it('should throw error if episode has no source text', async () => {
      mockPrisma.course.findUnique.mockResolvedValue({
        ...mockCourse,
        courseEpisodes: [
          {
            order: 0,
            episode: { id: 'episode-456', title: 'Test', sourceText: null },
          },
        ],
      });

      const processor = workerProcessors.get('course-generation')!;
      const job = createMockJob({ data: { courseId: 'course-123' } });

      await expect(processor(job)).rejects.toThrow('Episode has no source text');
    });

    it('should update course status to error on failure', async () => {
      mockExtractDialogueExchangesFromSourceText.mockRejectedValue(new Error('Extraction failed'));

      const processor = workerProcessors.get('course-generation')!;
      const job = createMockJob({ data: { courseId: 'course-123' } });

      await expect(processor(job)).rejects.toThrow('Extraction failed');

      expect(mockPrisma.course.update).toHaveBeenCalledWith({
        where: { id: 'course-123' },
        data: { status: 'error' },
      });
    });

    it('should log error and rethrow on failure', async () => {
      mockGenerateConversationalLessonScript.mockRejectedValue(
        new Error('Script generation failed')
      );

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const processor = workerProcessors.get('course-generation')!;
      const job = createMockJob({ data: { courseId: 'course-123' } });

      await expect(processor(job)).rejects.toThrow('Script generation failed');
      expect(consoleSpy).toHaveBeenCalledWith('Course generation failed:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('event handlers', () => {
    it('should log on completed event', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      triggerWorkerEvent('course-generation', 'completed', { id: 'job-123' });

      expect(consoleSpy).toHaveBeenCalledWith('Course job job-123 completed successfully');
      consoleSpy.mockRestore();
    });

    it('should log error on failed event', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      triggerWorkerEvent('course-generation', 'failed', { id: 'job-456' }, new Error('Test error'));

      expect(consoleSpy).toHaveBeenCalledWith('Course job job-456 failed:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('should log on progress event', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      triggerWorkerEvent('course-generation', 'progress', { id: 'job-789' }, 50);

      expect(consoleSpy).toHaveBeenCalledWith('Course job job-789 progress: 50%');
      consoleSpy.mockRestore();
    });
  });
});
