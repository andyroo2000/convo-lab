import { beforeEach, describe, expect, it, vi } from 'vitest';

const workerProcessors = vi.hoisted(() => new Map<string, (job: unknown) => Promise<unknown>>());
const queueAddMock = vi.hoisted(() => vi.fn());
const createRedisConnectionMock = vi.hoisted(() => vi.fn(() => ({})));
const processStudyImportJobMock = vi.hoisted(() => vi.fn());

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
  createRedisConnection: createRedisConnectionMock,
  defaultWorkerSettings: { concurrency: 1 },
}));

vi.mock('../../../services/study/import.js', () => ({
  processStudyImportJob: processStudyImportJobMock,
}));

describe('studyImportQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses separate Redis connections for the queue and worker', async () => {
    await import('../../../jobs/studyImportQueue.js');

    expect(createRedisConnectionMock).toHaveBeenCalledTimes(2);
  });

  it('enqueues study imports with retry/backoff settings', async () => {
    const { enqueueStudyImportJob } = await import('../../../jobs/studyImportQueue.js');

    await enqueueStudyImportJob('import-job-1');

    expect(queueAddMock).toHaveBeenCalledWith(
      'process-study-import',
      { importJobId: 'import-job-1' },
      expect.objectContaining({
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        jobId: 'import-job-1',
      })
    );
  });

  it('rejects malformed worker payloads before processing', async () => {
    await import('../../../jobs/studyImportQueue.js');
    const processor = workerProcessors.get('study-imports');

    await expect(
      processor?.({
        name: 'process-study-import',
        data: {},
        updateProgress: vi.fn(),
      })
    ).rejects.toThrow('Invalid study import job payload');
    expect(processStudyImportJobMock).not.toHaveBeenCalled();
  });

  it('processes valid study import worker payloads', async () => {
    processStudyImportJobMock.mockResolvedValue({ id: 'import-job-1' });
    await import('../../../jobs/studyImportQueue.js');
    const processor = workerProcessors.get('study-imports');
    const updateProgress = vi.fn();

    await processor?.({
      name: 'process-study-import',
      data: { importJobId: 'import-job-1' },
      updateProgress,
    });

    expect(processStudyImportJobMock).toHaveBeenCalledWith('import-job-1');
    expect(updateProgress).toHaveBeenCalledWith(100);
  });
});
