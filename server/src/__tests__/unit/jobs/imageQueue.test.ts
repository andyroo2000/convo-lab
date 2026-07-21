import { beforeEach, describe, expect, it, vi } from 'vitest';

import '../../../jobs/imageQueue.js';

const workerProcessors = vi.hoisted(() => new Map<string, (job: MockJob) => Promise<unknown>>());
const workerEventHandlers = vi.hoisted(
  () => new Map<string, Map<string, (...args: unknown[]) => void>>()
);
const mockGenerateAudioScriptSegmentImages = vi.hoisted(() => vi.fn());

interface MockJob {
  id: string;
  name: string;
  data: Record<string, unknown>;
  updateProgress: ReturnType<typeof vi.fn>;
}

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

    constructor(name: string, processor: (job: MockJob) => Promise<unknown>) {
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

vi.mock('../../../config/redis.js', () => ({
  createRedisConnection: vi.fn(() => ({})),
  defaultWorkerSettings: { concurrency: 1 },
}));

vi.mock('../../../services/audioScriptService.js', () => ({
  generateAudioScriptSegmentImages: mockGenerateAudioScriptSegmentImages,
}));

const createMockJob = (overrides: Partial<MockJob> = {}): MockJob => ({
  id: 'test-job-123',
  name: 'generate-script-images',
  data: {
    episodeId: 'episode-456',
    userId: 'user-123',
    force: true,
  },
  updateProgress: vi.fn(),
  ...overrides,
});

const triggerWorkerEvent = (queueName: string, event: string, ...args: unknown[]): void => {
  workerEventHandlers.get(queueName)?.get(event)?.(...args);
};

describe('imageQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateAudioScriptSegmentImages.mockResolvedValue({
      episodeId: 'episode-456',
      imageStatus: 'ready',
    });
  });

  it('registers the existing image-generation queue and event handlers', () => {
    expect(workerProcessors.get('image-generation')).toBeInstanceOf(Function);
    const handlers = workerEventHandlers.get('image-generation');
    expect(handlers?.has('completed')).toBe(true);
    expect(handlers?.has('failed')).toBe(true);
  });

  it('processes only script image jobs', async () => {
    const processor = workerProcessors.get('image-generation')!;
    const job = createMockJob();

    const result = await processor(job);

    expect(job.updateProgress).toHaveBeenCalledWith(10);
    expect(mockGenerateAudioScriptSegmentImages).toHaveBeenCalledWith({
      episodeId: 'episode-456',
      userId: 'user-123',
      force: true,
      onProgress: expect.any(Function),
    });
    expect(result).toEqual({ episodeId: 'episode-456', imageStatus: 'ready' });
  });

  it('forwards worker progress to BullMQ', async () => {
    const processor = workerProcessors.get('image-generation')!;
    const job = createMockJob();
    mockGenerateAudioScriptSegmentImages.mockImplementation(
      async ({ onProgress }: { onProgress: (progress: number) => Promise<void> }) => {
        await onProgress(64);
        return { episodeId: 'episode-456', imageStatus: 'generating' };
      }
    );

    await processor(job);

    expect(job.updateProgress).toHaveBeenNthCalledWith(1, 10);
    expect(job.updateProgress).toHaveBeenNthCalledWith(2, 64);
  });

  it.each([
    ['episodeId', { userId: 'user-123' }],
    ['userId', { episodeId: 'episode-456' }],
  ])('rejects script jobs missing %s', async (_missingField, data) => {
    const processor = workerProcessors.get('image-generation')!;

    await expect(processor(createMockJob({ data }))).rejects.toThrow(
      'Script image generation requires episodeId and userId'
    );
    expect(mockGenerateAudioScriptSegmentImages).not.toHaveBeenCalled();
  });

  it.each(['generate-images', 'default', ''])('rejects retired image job type %j', async (name) => {
    const processor = workerProcessors.get('image-generation')!;

    await expect(processor(createMockJob({ name }))).rejects.toThrow(
      `Unsupported image job type: ${name}`
    );
    expect(mockGenerateAudioScriptSegmentImages).not.toHaveBeenCalled();
  });

  it('logs and rethrows script generation failures', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGenerateAudioScriptSegmentImages.mockRejectedValue(new Error('API error'));
    const processor = workerProcessors.get('image-generation')!;

    await expect(processor(createMockJob())).rejects.toThrow('API error');
    expect(consoleSpy).toHaveBeenCalledWith('Image generation failed:', expect.any(Error));
    consoleSpy.mockRestore();
  });

  it('logs completed and failed worker events', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    triggerWorkerEvent('image-generation', 'completed', { id: 'job-123' });
    triggerWorkerEvent('image-generation', 'failed', { id: 'job-456' }, new Error('Test error'));

    expect(logSpy).toHaveBeenCalledWith('Image job job-123 completed');
    expect(errorSpy).toHaveBeenCalledWith('Image job job-456 failed:', expect.any(Error));
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
