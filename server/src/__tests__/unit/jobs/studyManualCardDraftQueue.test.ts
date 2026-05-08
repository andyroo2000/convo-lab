import { beforeEach, describe, expect, it, vi } from 'vitest';

const workerProcessors = vi.hoisted(() => new Map<string, (job: unknown) => Promise<unknown>>());
const queueAddMock = vi.hoisted(() => vi.fn());
const queueGetJobMock = vi.hoisted(() => vi.fn());
const processManualCardDraftMock = vi.hoisted(() => vi.fn());

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

vi.mock('../../../services/study/manualCardDrafts.js', () => ({
  processManualCardDraft: processManualCardDraftMock,
}));

describe('studyManualCardDraftQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queueGetJobMock.mockResolvedValue(null);
  });

  it('enqueues manual card drafts with a stable job id and single processor attempt', async () => {
    const { enqueueStudyManualCardDraftJob } =
      await import('../../../jobs/studyManualCardDraftQueue.js');

    await enqueueStudyManualCardDraftJob('draft-1');

    expect(queueAddMock).toHaveBeenCalledWith(
      'complete-manual-card-draft',
      { draftId: 'draft-1' },
      expect.objectContaining({
        jobId: 'draft-1',
        attempts: 1,
        removeOnComplete: expect.any(Object),
        removeOnFail: expect.any(Object),
      })
    );
  });

  it('removes stale previous jobs before requeueing', async () => {
    const previousJob = {
      getState: vi.fn().mockResolvedValue('failed'),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    queueGetJobMock.mockResolvedValue(previousJob);
    const { enqueueStudyManualCardDraftJob } =
      await import('../../../jobs/studyManualCardDraftQueue.js');

    await enqueueStudyManualCardDraftJob('draft-1');

    expect(previousJob.remove).toHaveBeenCalled();
    expect(queueAddMock).toHaveBeenCalledWith(
      'complete-manual-card-draft',
      { draftId: 'draft-1' },
      expect.objectContaining({ jobId: 'draft-1' })
    );
  });

  it('does not enqueue duplicate active jobs', async () => {
    const activeJob = {
      getState: vi.fn().mockResolvedValue('active'),
      remove: vi.fn(),
    };
    queueGetJobMock.mockResolvedValue(activeJob);
    const { enqueueStudyManualCardDraftJob } =
      await import('../../../jobs/studyManualCardDraftQueue.js');

    await expect(enqueueStudyManualCardDraftJob('draft-1')).resolves.toBe(activeJob);

    expect(activeJob.remove).not.toHaveBeenCalled();
    expect(queueAddMock).not.toHaveBeenCalled();
  });

  it('rejects malformed worker payloads', async () => {
    await import('../../../jobs/studyManualCardDraftQueue.js');
    const processor = workerProcessors.get('study-manual-card-drafts');

    await expect(
      processor?.({
        name: 'complete-manual-card-draft',
        data: {},
        updateProgress: vi.fn(),
      })
    ).rejects.toThrow('Invalid manual card draft job payload');
    expect(processManualCardDraftMock).not.toHaveBeenCalled();
  });

  it('dispatches valid worker payloads to the draft processor', async () => {
    processManualCardDraftMock.mockResolvedValue({ id: 'draft-1', status: 'ready' });
    await import('../../../jobs/studyManualCardDraftQueue.js');
    const processor = workerProcessors.get('study-manual-card-drafts');
    const updateProgress = vi.fn();

    await processor?.({
      name: 'complete-manual-card-draft',
      data: { draftId: 'draft-1' },
      updateProgress,
    });

    expect(processManualCardDraftMock).toHaveBeenCalledWith('draft-1');
    expect(updateProgress).toHaveBeenCalledWith(100);
  });
});
