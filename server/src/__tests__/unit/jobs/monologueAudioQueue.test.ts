import { beforeEach, describe, expect, it, vi } from 'vitest';

const workerProcessors = vi.hoisted(() => new Map<string, (job: unknown) => Promise<unknown>>());
const queueAddMock = vi.hoisted(() => vi.fn());
const generateMonologueFullAudioTakeMock = vi.hoisted(() => vi.fn());
const markMonologueFullAudioRenderFailedMock = vi.hoisted(() => vi.fn());

vi.mock('bullmq', () => ({
  Queue: class MockQueue {
    add = queueAddMock;

    constructor(
      public name: string,
      public options: unknown
    ) {}
  },
  Worker: class MockWorker {
    constructor(name: string, processor: (job: unknown) => Promise<unknown>) {
      workerProcessors.set(name, processor);
    }

    on(): this {
      return this;
    }
  },
}));

vi.mock('../../../config/redis.js', () => ({
  createRedisConnection: vi.fn(() => ({})),
  defaultWorkerSettings: { concurrency: 1 },
}));

vi.mock('../../../services/monologueService.js', () => ({
  generateMonologueFullAudioTake: generateMonologueFullAudioTakeMock,
  markMonologueFullAudioRenderFailed: markMonologueFullAudioRenderFailedMock,
}));

function renderJob(overrides: Record<string, unknown> = {}) {
  return {
    name: 'render-full-audio',
    data: {
      projectId: 'project-1',
      scriptVersionId: 'version-1',
      userId: 'user-1',
    },
    attemptsMade: 0,
    opts: { attempts: 2 },
    updateProgress: vi.fn(),
    ...overrides,
  };
}

describe('monologueAudioQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enqueues full audio renders with retry attempts', async () => {
    const { enqueueMonologueFullAudioRenderJob } =
      await import('../../../jobs/monologueAudioQueue.js');

    await enqueueMonologueFullAudioRenderJob({
      projectId: 'project-1',
      scriptVersionId: 'version-1',
      userId: 'user-1',
    });

    expect(queueAddMock).toHaveBeenCalledWith(
      'render-full-audio',
      {
        projectId: 'project-1',
        scriptVersionId: 'version-1',
        userId: 'user-1',
      },
      expect.objectContaining({
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: 50,
        removeOnFail: 50,
      })
    );
  });

  it('dispatches valid worker payloads to the full-audio renderer', async () => {
    generateMonologueFullAudioTakeMock.mockResolvedValue({ id: 'take-1' });
    await import('../../../jobs/monologueAudioQueue.js');
    const processor = workerProcessors.get('monologue-full-audio-render');
    const updateProgress = vi.fn();

    await processor?.(renderJob({ updateProgress }));

    expect(generateMonologueFullAudioTakeMock).toHaveBeenCalledWith('user-1', 'project-1', {
      expectedScriptVersionId: 'version-1',
    });
    expect(updateProgress).toHaveBeenCalledWith(100);
  });

  it('does not mark renders failed before BullMQ retries are exhausted', async () => {
    generateMonologueFullAudioTakeMock.mockRejectedValueOnce(new Error('transient'));
    await import('../../../jobs/monologueAudioQueue.js');
    const processor = workerProcessors.get('monologue-full-audio-render');

    await expect(processor?.(renderJob({ attemptsMade: 0 }))).rejects.toThrow('transient');

    expect(markMonologueFullAudioRenderFailedMock).not.toHaveBeenCalled();
  });

  it('marks renders failed on the final BullMQ attempt', async () => {
    generateMonologueFullAudioTakeMock.mockRejectedValueOnce(new Error('still broken'));
    await import('../../../jobs/monologueAudioQueue.js');
    const processor = workerProcessors.get('monologue-full-audio-render');

    await expect(processor?.(renderJob({ attemptsMade: 1 }))).rejects.toThrow('still broken');

    expect(markMonologueFullAudioRenderFailedMock).toHaveBeenCalledWith(
      'user-1',
      'project-1',
      'version-1'
    );
  });

  it('rejects malformed worker payloads', async () => {
    await import('../../../jobs/monologueAudioQueue.js');
    const processor = workerProcessors.get('monologue-full-audio-render');

    await expect(processor?.(renderJob({ data: {} }))).rejects.toThrow(
      'Invalid monologue full-audio render job payload'
    );

    expect(generateMonologueFullAudioTakeMock).not.toHaveBeenCalled();
    expect(markMonologueFullAudioRenderFailedMock).not.toHaveBeenCalled();
  });
});
