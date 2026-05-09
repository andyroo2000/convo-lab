import { beforeEach, describe, expect, it, vi } from 'vitest';

const workerProcessors = vi.hoisted(() => new Map<string, (job: unknown) => Promise<unknown>>());
const queueAddMock = vi.hoisted(() => vi.fn());
const queueGetJobMock = vi.hoisted(() => vi.fn());
const processStudyVocabBundleDraftsMock = vi.hoisted(() => vi.fn());
const VocabBundleDraftMismatchErrorMock = vi.hoisted(
  () =>
    class VocabBundleDraftMismatchError extends Error {
      constructor() {
        super('Generated vocab bundle did not match queued draft placeholders.');
      }
    }
);

vi.mock('bullmq', () => ({
  Queue: class MockQueue {
    add = queueAddMock;

    getJob = queueGetJobMock;

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

vi.mock('../../../services/studyVocabBundleService.js', () => ({
  processStudyVocabBundleDrafts: processStudyVocabBundleDraftsMock,
  VocabBundleDraftMismatchError: VocabBundleDraftMismatchErrorMock,
}));

describe('studyVocabBundleDraftQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queueGetJobMock.mockResolvedValue(null);
  });

  it('enqueues vocab bundle draft groups with a stable job id and retry backoff', async () => {
    const { enqueueStudyVocabBundleDraftJob } =
      await import('../../../jobs/studyVocabBundleDraftQueue.js');

    await enqueueStudyVocabBundleDraftJob('group-1');

    expect(queueAddMock).toHaveBeenCalledWith(
      'complete-vocab-bundle-drafts',
      { groupId: 'group-1' },
      expect.objectContaining({
        jobId: 'group-1',
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: expect.any(Object),
        removeOnFail: expect.any(Object),
      })
    );
  });

  it('does not enqueue duplicate active group jobs', async () => {
    const activeJob = {
      getState: vi.fn().mockResolvedValue('active'),
      remove: vi.fn(),
    };
    queueGetJobMock.mockResolvedValue(activeJob);
    const { enqueueStudyVocabBundleDraftJob } =
      await import('../../../jobs/studyVocabBundleDraftQueue.js');

    await expect(enqueueStudyVocabBundleDraftJob('group-1')).resolves.toBe(activeJob);

    expect(activeJob.remove).not.toHaveBeenCalled();
    expect(queueAddMock).not.toHaveBeenCalled();
  });

  it('does not enqueue duplicate prioritized group jobs', async () => {
    const prioritizedJob = {
      getState: vi.fn().mockResolvedValue('prioritized'),
      remove: vi.fn(),
      retry: vi.fn(),
    };
    queueGetJobMock.mockResolvedValue(prioritizedJob);
    const { enqueueStudyVocabBundleDraftJob } =
      await import('../../../jobs/studyVocabBundleDraftQueue.js');

    await expect(enqueueStudyVocabBundleDraftJob('group-1')).resolves.toBe(prioritizedJob);

    expect(prioritizedJob.retry).not.toHaveBeenCalled();
    expect(prioritizedJob.remove).not.toHaveBeenCalled();
    expect(queueAddMock).not.toHaveBeenCalled();
  });

  it('leaves an existing failed group job alone as a historical record', async () => {
    const failedJob = {
      getState: vi.fn().mockResolvedValue('failed'),
      remove: vi.fn(),
      retry: vi.fn(),
    };
    queueGetJobMock.mockResolvedValue(failedJob);
    const { enqueueStudyVocabBundleDraftJob } =
      await import('../../../jobs/studyVocabBundleDraftQueue.js');

    await expect(enqueueStudyVocabBundleDraftJob('group-1')).resolves.toBe(failedJob);

    expect(failedJob.retry).not.toHaveBeenCalled();
    expect(failedJob.remove).not.toHaveBeenCalled();
    expect(queueAddMock).not.toHaveBeenCalled();
  });

  it('does not re-enqueue a completed historical group job', async () => {
    const completedJob = {
      getState: vi.fn().mockResolvedValue('completed'),
      remove: vi.fn(),
      retry: vi.fn(),
    };
    queueGetJobMock.mockResolvedValue(completedJob);
    const { enqueueStudyVocabBundleDraftJob } =
      await import('../../../jobs/studyVocabBundleDraftQueue.js');

    await expect(enqueueStudyVocabBundleDraftJob('group-1')).resolves.toBe(completedJob);

    expect(completedJob.retry).not.toHaveBeenCalled();
    expect(completedJob.remove).not.toHaveBeenCalled();
    expect(queueAddMock).not.toHaveBeenCalled();
  });

  it('keeps unrecognized future group job states stable', async () => {
    const futureStateJob = {
      getState: vi.fn().mockResolvedValue('future-state'),
      remove: vi.fn(),
      retry: vi.fn(),
    };
    queueGetJobMock.mockResolvedValue(futureStateJob);
    const { enqueueStudyVocabBundleDraftJob } =
      await import('../../../jobs/studyVocabBundleDraftQueue.js');

    await expect(enqueueStudyVocabBundleDraftJob('group-1')).resolves.toBe(futureStateJob);

    expect(futureStateJob.retry).not.toHaveBeenCalled();
    expect(futureStateJob.remove).not.toHaveBeenCalled();
    expect(queueAddMock).not.toHaveBeenCalled();
  });

  it('dispatches valid worker payloads to the vocab bundle draft processor', async () => {
    processStudyVocabBundleDraftsMock.mockResolvedValue({
      groupId: 'group-1',
      completedDraftCount: 11,
    });
    await import('../../../jobs/studyVocabBundleDraftQueue.js');
    const processor = workerProcessors.get('study-vocab-bundle-drafts');
    const updateProgress = vi.fn();

    await processor?.({
      name: 'complete-vocab-bundle-drafts',
      data: { groupId: 'group-1' },
      attemptsMade: 0,
      opts: { attempts: 3 },
      updateProgress,
    });

    expect(processStudyVocabBundleDraftsMock).toHaveBeenCalledWith('group-1', {
      markDraftsOnError: false,
    });
    expect(updateProgress).toHaveBeenCalledWith(100);
  });

  it('marks drafts as error only on the final processor attempt', async () => {
    processStudyVocabBundleDraftsMock.mockResolvedValue({
      groupId: 'group-1',
      completedDraftCount: 11,
    });
    await import('../../../jobs/studyVocabBundleDraftQueue.js');
    const processor = workerProcessors.get('study-vocab-bundle-drafts');

    await processor?.({
      name: 'complete-vocab-bundle-drafts',
      data: { groupId: 'group-1' },
      attemptsMade: 2,
      opts: { attempts: 3 },
      updateProgress: vi.fn(),
    });

    expect(processStudyVocabBundleDraftsMock).toHaveBeenCalledWith('group-1', {
      markDraftsOnError: true,
    });
  });

  it('discards non-retryable mismatch worker failures', async () => {
    const mismatchError = new VocabBundleDraftMismatchErrorMock();
    processStudyVocabBundleDraftsMock.mockRejectedValue(mismatchError);
    await import('../../../jobs/studyVocabBundleDraftQueue.js');
    const processor = workerProcessors.get('study-vocab-bundle-drafts');
    const discard = vi.fn();

    await expect(
      processor?.({
        name: 'complete-vocab-bundle-drafts',
        data: { groupId: 'group-1' },
        attemptsMade: 0,
        opts: { attempts: 3 },
        discard,
        updateProgress: vi.fn(),
      })
    ).rejects.toBe(mismatchError);

    expect(processStudyVocabBundleDraftsMock).toHaveBeenCalledWith('group-1', {
      markDraftsOnError: false,
    });
    expect(discard).toHaveBeenCalled();
  });
});
