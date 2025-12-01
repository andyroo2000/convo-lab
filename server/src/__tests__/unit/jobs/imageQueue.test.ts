import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mocks for capturing worker processor and events
const workerProcessors = vi.hoisted(() => new Map<string, (job: unknown) => Promise<unknown>>());
const workerEventHandlers = vi.hoisted(() => new Map<string, Map<string, (...args: unknown[]) => void>>());
const mockGenerateDialogueImages = vi.hoisted(() => vi.fn());

// Mock BullMQ
vi.mock('bullmq', () => {
  return {
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
  };
});

// Mock Redis config
vi.mock('../../../config/redis.js', () => ({
  createRedisConnection: vi.fn(() => ({})),
  defaultWorkerSettings: { concurrency: 1 },
}));

// Mock image generator
vi.mock('../../../services/imageGenerator.js', () => ({
  generateDialogueImages: mockGenerateDialogueImages,
}));

// Import after mocking
import '../../../jobs/imageQueue.js';

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

describe('imageQueue', () => {
  const mockImageResult = [
    { id: 'image-1', url: 'https://storage.example.com/image1.jpg', order: 0 },
    { id: 'image-2', url: 'https://storage.example.com/image2.jpg', order: 1 },
    { id: 'image-3', url: 'https://storage.example.com/image3.jpg', order: 2 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateDialogueImages.mockResolvedValue(mockImageResult);
  });

  describe('queue setup', () => {
    it('should register worker processor for "image-generation" queue', () => {
      const processor = workerProcessors.get('image-generation');
      expect(processor).toBeDefined();
      expect(processor).toBeInstanceOf(Function);
    });

    it('should register event handlers for the worker', () => {
      const handlers = workerEventHandlers.get('image-generation');
      expect(handlers).toBeDefined();
      expect(handlers?.has('completed')).toBe(true);
      expect(handlers?.has('failed')).toBe(true);
    });
  });

  describe('job processing', () => {
    it('should call generateDialogueImages with job data', async () => {
      const processor = workerProcessors.get('image-generation')!;
      const job = createMockJob({
        data: {
          userId: 'user-123',
          episodeId: 'episode-456',
          dialogueId: 'dialogue-789',
          imageCount: 5,
        },
      });

      await processor(job);

      expect(mockGenerateDialogueImages).toHaveBeenCalledWith({
        episodeId: 'episode-456',
        dialogueId: 'dialogue-789',
        imageCount: 5,
      });
    });

    it('should pass imageCount from job data when provided', async () => {
      const processor = workerProcessors.get('image-generation')!;
      const job = createMockJob({
        data: {
          episodeId: 'episode-456',
          dialogueId: 'dialogue-789',
          imageCount: 10,
        },
      });

      await processor(job);

      expect(mockGenerateDialogueImages).toHaveBeenCalledWith(
        expect.objectContaining({ imageCount: 10 })
      );
    });

    it('should handle job without explicit imageCount', async () => {
      const processor = workerProcessors.get('image-generation')!;
      const job = createMockJob({
        data: {
          episodeId: 'episode-456',
          dialogueId: 'dialogue-789',
        },
      });

      await processor(job);

      expect(mockGenerateDialogueImages).toHaveBeenCalledWith({
        episodeId: 'episode-456',
        dialogueId: 'dialogue-789',
        imageCount: undefined,
      });
    });

    it('should update progress to 10% at start and 100% at end', async () => {
      const processor = workerProcessors.get('image-generation')!;
      const job = createMockJob({
        data: {
          episodeId: 'episode-456',
          dialogueId: 'dialogue-789',
        },
      });

      await processor(job);

      expect(job.updateProgress).toHaveBeenCalledWith(10);
      expect(job.updateProgress).toHaveBeenCalledWith(100);
    });

    it('should return result from generateDialogueImages', async () => {
      const processor = workerProcessors.get('image-generation')!;
      const job = createMockJob({
        data: {
          episodeId: 'episode-456',
          dialogueId: 'dialogue-789',
        },
      });

      const result = await processor(job);

      expect(result).toEqual(mockImageResult);
    });

    it('should throw error when generateDialogueImages fails', async () => {
      mockGenerateDialogueImages.mockRejectedValue(new Error('Image generation failed'));

      const processor = workerProcessors.get('image-generation')!;
      const job = createMockJob({
        data: {
          episodeId: 'episode-456',
          dialogueId: 'dialogue-789',
        },
      });

      await expect(processor(job)).rejects.toThrow('Image generation failed');
    });

    it('should log error when image generation fails', async () => {
      mockGenerateDialogueImages.mockRejectedValue(new Error('API error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const processor = workerProcessors.get('image-generation')!;
      const job = createMockJob({
        data: { episodeId: 'episode-456', dialogueId: 'dialogue-789' },
      });

      await expect(processor(job)).rejects.toThrow('API error');
      expect(consoleSpy).toHaveBeenCalledWith('Image generation failed:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('event handlers', () => {
    it('should log on completed event', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      triggerWorkerEvent('image-generation', 'completed', { id: 'job-123' });

      expect(consoleSpy).toHaveBeenCalledWith('Image job job-123 completed');
      consoleSpy.mockRestore();
    });

    it('should log error on failed event', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      triggerWorkerEvent('image-generation', 'failed', { id: 'job-456' }, new Error('Test error'));

      expect(consoleSpy).toHaveBeenCalledWith('Image job job-456 failed:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });
});
