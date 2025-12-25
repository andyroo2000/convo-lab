import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import after mocking
import '../../../jobs/audioQueue.js';

// Hoisted mocks for capturing worker processor and events
const workerProcessors = vi.hoisted(() => new Map<string, (job: unknown) => Promise<unknown>>());
const workerEventHandlers = vi.hoisted(() => new Map<string, Map<string, (...args: unknown[]) => void>>());
const mockGenerateEpisodeAudio = vi.hoisted(() => vi.fn());
const mockGenerateAllSpeedsAudio = vi.hoisted(() => vi.fn());

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

// Mock audio generator
vi.mock('../../../services/audioGenerator.js', () => ({
  generateEpisodeAudio: mockGenerateEpisodeAudio,
  generateAllSpeedsAudio: mockGenerateAllSpeedsAudio,
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

describe('audioQueue', () => {
  const mockAudioResult = {
    audioUrl: 'https://storage.example.com/audio.mp3',
    duration: 120,
  };

  const mockAllSpeedsResult = {
    speeds: [
      { speed: 0.7, audioUrl: 'https://storage.example.com/audio-0.7.mp3' },
      { speed: 0.85, audioUrl: 'https://storage.example.com/audio-0.85.mp3' },
      { speed: 1.0, audioUrl: 'https://storage.example.com/audio-1.0.mp3' },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateEpisodeAudio.mockResolvedValue(mockAudioResult);
    mockGenerateAllSpeedsAudio.mockResolvedValue(mockAllSpeedsResult);
  });

  describe('queue setup', () => {
    it('should register worker processor for "audio-generation" queue', () => {
      const processor = workerProcessors.get('audio-generation');
      expect(processor).toBeDefined();
      expect(processor).toBeInstanceOf(Function);
    });

    it('should register event handlers for the worker', () => {
      const handlers = workerEventHandlers.get('audio-generation');
      expect(handlers).toBeDefined();
      expect(handlers?.has('completed')).toBe(true);
      expect(handlers?.has('failed')).toBe(true);
    });
  });

  describe('generate-all-speeds job type', () => {
    it('should call generateAllSpeedsAudio for generate-all-speeds job', async () => {
      const processor = workerProcessors.get('audio-generation')!;
      const job = createMockJob({
        name: 'generate-all-speeds',
        data: {
          episodeId: 'episode-123',
          dialogueId: 'dialogue-456',
        },
      });

      await processor(job);

      expect(mockGenerateAllSpeedsAudio).toHaveBeenCalledWith(
        'episode-123',
        'dialogue-456',
        expect.any(Function)
      );
    });

    it('should pass progress callback to generateAllSpeedsAudio', async () => {
      const processor = workerProcessors.get('audio-generation')!;
      const job = createMockJob({
        name: 'generate-all-speeds',
        data: {
          episodeId: 'episode-123',
          dialogueId: 'dialogue-456',
        },
      });

      await processor(job);

      // Get the progress callback that was passed
      const progressCallback = mockGenerateAllSpeedsAudio.mock.calls[0][2];
      progressCallback(50);

      expect(job.updateProgress).toHaveBeenCalledWith(50);
    });

    it('should return result from generateAllSpeedsAudio', async () => {
      const processor = workerProcessors.get('audio-generation')!;
      const job = createMockJob({
        name: 'generate-all-speeds',
        data: {
          episodeId: 'episode-123',
          dialogueId: 'dialogue-456',
        },
      });

      const result = await processor(job);

      expect(result).toEqual(mockAllSpeedsResult);
    });

    it('should throw error when generateAllSpeedsAudio fails', async () => {
      mockGenerateAllSpeedsAudio.mockRejectedValue(new Error('Multi-speed generation failed'));

      const processor = workerProcessors.get('audio-generation')!;
      const job = createMockJob({
        name: 'generate-all-speeds',
        data: {
          episodeId: 'episode-123',
          dialogueId: 'dialogue-456',
        },
      });

      await expect(processor(job)).rejects.toThrow('Multi-speed generation failed');
    });

    it('should log error when multi-speed generation fails', async () => {
      mockGenerateAllSpeedsAudio.mockRejectedValue(new Error('API error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const processor = workerProcessors.get('audio-generation')!;
      const job = createMockJob({
        name: 'generate-all-speeds',
        data: { episodeId: 'episode-123', dialogueId: 'dialogue-456' },
      });

      await expect(processor(job)).rejects.toThrow('API error');
      expect(consoleSpy).toHaveBeenCalledWith('Multi-speed audio generation failed:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('legacy single-speed job type', () => {
    it('should call generateEpisodeAudio for non-generate-all-speeds jobs', async () => {
      const processor = workerProcessors.get('audio-generation')!;
      const job = createMockJob({
        name: 'default',
        data: {
          userId: 'user-123',
          episodeId: 'episode-456',
          dialogueId: 'dialogue-789',
          speed: 0.85,
          pauseMode: 'short',
        },
      });

      await processor(job);

      expect(mockGenerateEpisodeAudio).toHaveBeenCalledWith({
        episodeId: 'episode-456',
        dialogueId: 'dialogue-789',
        speed: 0.85,
        pauseMode: 'short',
      });
    });

    it('should update progress to 10% at start and 100% at end for legacy job', async () => {
      const processor = workerProcessors.get('audio-generation')!;
      const job = createMockJob({
        name: 'default',
        data: {
          userId: 'user-123',
          episodeId: 'episode-456',
          dialogueId: 'dialogue-789',
          speed: 1.0,
        },
      });

      await processor(job);

      expect(job.updateProgress).toHaveBeenCalledWith(10);
      expect(job.updateProgress).toHaveBeenCalledWith(100);
    });

    it('should return result from generateEpisodeAudio', async () => {
      const processor = workerProcessors.get('audio-generation')!;
      const job = createMockJob({
        name: 'default',
        data: {
          episodeId: 'episode-456',
          dialogueId: 'dialogue-789',
          speed: 1.0,
        },
      });

      const result = await processor(job);

      expect(result).toEqual(mockAudioResult);
    });

    it('should throw error when generateEpisodeAudio fails', async () => {
      mockGenerateEpisodeAudio.mockRejectedValue(new Error('Audio generation failed'));

      const processor = workerProcessors.get('audio-generation')!;
      const job = createMockJob({
        name: 'default',
        data: {
          episodeId: 'episode-456',
          dialogueId: 'dialogue-789',
          speed: 1.0,
        },
      });

      await expect(processor(job)).rejects.toThrow('Audio generation failed');
    });

    it('should log error when legacy generation fails', async () => {
      mockGenerateEpisodeAudio.mockRejectedValue(new Error('TTS error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const processor = workerProcessors.get('audio-generation')!;
      const job = createMockJob({
        name: 'default',
        data: { episodeId: 'episode-456', dialogueId: 'dialogue-789', speed: 1.0 },
      });

      await expect(processor(job)).rejects.toThrow('TTS error');
      expect(consoleSpy).toHaveBeenCalledWith('Audio generation failed:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('event handlers', () => {
    it('should log on completed event', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      triggerWorkerEvent('audio-generation', 'completed', { id: 'job-123' });

      expect(consoleSpy).toHaveBeenCalledWith('Audio job job-123 completed');
      consoleSpy.mockRestore();
    });

    it('should log error on failed event', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      triggerWorkerEvent('audio-generation', 'failed', { id: 'job-456' }, new Error('Test error'));

      expect(consoleSpy).toHaveBeenCalledWith('Audio job job-456 failed:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });
});
