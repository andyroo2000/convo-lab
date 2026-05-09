import { beforeEach, describe, expect, it, vi } from 'vitest';

const workerProcessors = vi.hoisted(() => new Map<string, (job: unknown) => Promise<unknown>>());
const queueAddMock = vi.hoisted(() => vi.fn());
const queueGetJobMock = vi.hoisted(() => vi.fn());
const processStudyVocabBundleDraftsMock = vi.hoisted(() => vi.fn());

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
}));

describe('studyVocabBundleDraftQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queueGetJobMock.mockResolvedValue(null);
  });

  it('enqueues vocab bundle draft groups with a stable job id and single processor attempt', async () => {
    const { enqueueStudyVocabBundleDraftJob } =
      await import('../../../jobs/studyVocabBundleDraftQueue.js');

    await enqueueStudyVocabBundleDraftJob('group-1');

    expect(queueAddMock).toHaveBeenCalledWith(
      'complete-vocab-bundle-drafts',
      { groupId: 'group-1' },
      expect.objectContaining({
        jobId: 'group-1',
        attempts: 1,
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
      updateProgress,
    });

    expect(processStudyVocabBundleDraftsMock).toHaveBeenCalledWith('group-1');
    expect(updateProgress).toHaveBeenCalledWith(100);
  });
});
