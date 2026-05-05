import { beforeEach, describe, expect, it, vi } from 'vitest';

const workerProcessors = vi.hoisted(() => new Map<string, (job: unknown) => Promise<unknown>>());
const queueAddMock = vi.hoisted(() => vi.fn());
const processDailyAudioPracticeJobMock = vi.hoisted(() => vi.fn());

vi.mock('bullmq', () => ({
  Queue: class MockQueue {
    add = queueAddMock;

    getJob = vi.fn();

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

vi.mock('../../../services/dailyAudioPractice/generationService.js', () => ({
  processDailyAudioPracticeJob: processDailyAudioPracticeJobMock,
}));

describe('dailyAudioPracticeQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enqueues practice generation with a stable job id', async () => {
    const { enqueueDailyAudioPracticeJob } =
      await import('../../../jobs/dailyAudioPracticeQueue.js');

    await enqueueDailyAudioPracticeJob('practice-1');

    expect(queueAddMock).toHaveBeenCalledWith(
      'generate-daily-audio-practice',
      { practiceId: 'practice-1' },
      expect.objectContaining({
        jobId: 'practice-1',
        attempts: 2,
      })
    );
  });

  it('rejects malformed worker payloads', async () => {
    await import('../../../jobs/dailyAudioPracticeQueue.js');
    const processor = workerProcessors.get('daily-audio-practice-generation');

    await expect(processor?.({ data: {}, updateProgress: vi.fn() })).rejects.toThrow(
      'Invalid daily audio practice job payload'
    );
    expect(processDailyAudioPracticeJobMock).not.toHaveBeenCalled();
  });

  it('processes valid worker payloads with progress updates', async () => {
    processDailyAudioPracticeJobMock.mockResolvedValue({ practiceId: 'practice-1' });
    await import('../../../jobs/dailyAudioPracticeQueue.js');
    const processor = workerProcessors.get('daily-audio-practice-generation');
    const updateProgress = vi.fn();

    await processor?.({ data: { practiceId: 'practice-1' }, updateProgress });

    expect(processDailyAudioPracticeJobMock).toHaveBeenCalledWith({
      practiceId: 'practice-1',
      onProgress: expect.any(Function),
    });
    await processDailyAudioPracticeJobMock.mock.calls[0][0].onProgress(42);
    expect(updateProgress).toHaveBeenCalledWith(42);
  });
});
