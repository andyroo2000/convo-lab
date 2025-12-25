import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import after mocking
import '../../../jobs/dialogueQueue.js';

// Hoisted mocks for capturing worker processor and events
const workerProcessors = vi.hoisted(() => new Map<string, (job: unknown) => Promise<unknown>>());
const workerEventHandlers = vi.hoisted(() => new Map<string, Map<string, (...args: unknown[]) => void>>());
const mockGenerateDialogue = vi.hoisted(() => vi.fn());

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

// Mock dialogue generator
vi.mock('../../../services/dialogueGenerator.js', () => ({
  generateDialogue: mockGenerateDialogue,
}));

// Helper to create mock job
const createMockJob = (overrides: Partial<{
  id: string;
  name: string;
  data: Record<string, unknown>;
  updateProgress: ReturnType<typeof vi.fn>;
}> = {}) => ({
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

describe('dialogueQueue', () => {
  const mockDialogueResult = {
    dialogue: { id: 'dialogue-123' },
    speakers: [{ id: 'speaker-1', name: 'Tanaka' }],
    sentences: [{ id: 'sentence-1', text: 'Hello' }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateDialogue.mockResolvedValue(mockDialogueResult);
  });

  describe('queue setup', () => {
    it('should register worker processor for "dialogue-generation" queue', () => {
      const processor = workerProcessors.get('dialogue-generation');
      expect(processor).toBeDefined();
      expect(processor).toBeInstanceOf(Function);
    });

    it('should register event handlers for the worker', () => {
      const handlers = workerEventHandlers.get('dialogue-generation');
      expect(handlers).toBeDefined();
      expect(handlers?.has('completed')).toBe(true);
      expect(handlers?.has('failed')).toBe(true);
    });
  });

  describe('job processing', () => {
    it('should call generateDialogue with job data', async () => {
      const processor = workerProcessors.get('dialogue-generation')!;
      const job = createMockJob({
        data: {
          userId: 'user-123',
          episodeId: 'episode-456',
          speakers: [{ name: 'Tanaka', voiceId: 'ja-JP-Neural2-B' }],
          variationCount: 3,
          dialogueLength: 6,
        },
      });

      await processor(job);

      expect(mockGenerateDialogue).toHaveBeenCalledWith({
        episodeId: 'episode-456',
        speakers: [{ name: 'Tanaka', voiceId: 'ja-JP-Neural2-B' }],
        variationCount: 3,
        dialogueLength: 6,
      });
    });

    it('should update progress to 10% at start and 100% at end', async () => {
      const processor = workerProcessors.get('dialogue-generation')!;
      const job = createMockJob({
        data: {
          userId: 'user-123',
          episodeId: 'episode-456',
          speakers: [],
        },
      });

      await processor(job);

      expect(job.updateProgress).toHaveBeenCalledWith(10);
      expect(job.updateProgress).toHaveBeenCalledWith(100);
    });

    it('should return result from generateDialogue', async () => {
      const processor = workerProcessors.get('dialogue-generation')!;
      const job = createMockJob({
        data: {
          userId: 'user-123',
          episodeId: 'episode-456',
          speakers: [],
        },
      });

      const result = await processor(job);

      expect(result).toEqual(mockDialogueResult);
    });

    it('should throw error when generateDialogue fails', async () => {
      mockGenerateDialogue.mockRejectedValue(new Error('Generation failed'));

      const processor = workerProcessors.get('dialogue-generation')!;
      const job = createMockJob({
        data: {
          userId: 'user-123',
          episodeId: 'episode-456',
          speakers: [],
        },
      });

      await expect(processor(job)).rejects.toThrow('Generation failed');
    });

    it('should not update status on error - only logs and rethrows', async () => {
      mockGenerateDialogue.mockRejectedValue(new Error('API error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const processor = workerProcessors.get('dialogue-generation')!;
      const job = createMockJob({
        data: { episodeId: 'episode-456', speakers: [] },
      });

      await expect(processor(job)).rejects.toThrow('API error');
      expect(consoleSpy).toHaveBeenCalledWith('Dialogue generation failed:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('event handlers', () => {
    it('should log on completed event', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      triggerWorkerEvent('dialogue-generation', 'completed', { id: 'job-123' });

      expect(consoleSpy).toHaveBeenCalledWith('Dialogue job job-123 completed');
      consoleSpy.mockRestore();
    });

    it('should log error on failed event', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      triggerWorkerEvent('dialogue-generation', 'failed', { id: 'job-456' }, new Error('Test error'));

      expect(consoleSpy).toHaveBeenCalledWith('Dialogue job job-456 failed:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });
});
