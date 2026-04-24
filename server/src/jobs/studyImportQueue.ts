/* eslint-disable no-console */
import { Queue, Worker } from 'bullmq';

import { createRedisConnection, defaultWorkerSettings } from '../config/redis.js';

const queueConnection = createRedisConnection();
const workerConnection = createRedisConnection();
const STUDY_IMPORT_QUEUE_NAME = 'study-imports';

export const studyImportQueue = new Queue(STUDY_IMPORT_QUEUE_NAME, { connection: queueConnection });

function parseStudyImportJobData(data: unknown): { importJobId: string } {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid study import job payload.');
  }

  const record = data as Record<string, unknown>;
  if (typeof record.importJobId !== 'string' || record.importJobId.trim().length === 0) {
    throw new Error('Invalid study import job payload.');
  }

  return { importJobId: record.importJobId };
}

export async function enqueueStudyImportJob(importJobId: string) {
  return studyImportQueue.add(
    'process-study-import',
    { importJobId },
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      jobId: importJobId,
      removeOnComplete: 50,
      removeOnFail: 50,
    }
  );
}

export const studyImportWorker = new Worker(
  STUDY_IMPORT_QUEUE_NAME,
  async (job) => {
    if (job.name !== 'process-study-import') {
      throw new Error(`Unsupported study import job "${job.name}".`);
    }

    const { processStudyImportJob } = await import('../services/study/import.js');
    const { importJobId } = parseStudyImportJobData(job.data);
    const result = await processStudyImportJob(importJobId);
    await job.updateProgress(100);
    return result;
  },
  {
    connection: workerConnection,
    ...defaultWorkerSettings,
  }
);

studyImportWorker.on('completed', (job) => {
  console.log(`Study import job ${job.id} completed`);
});

studyImportWorker.on('failed', (job, err) => {
  console.error(`Study import job ${job?.id} failed:`, err);
});
