/* eslint-disable no-console */
import { Queue, Worker } from 'bullmq';

import { createRedisConnection, defaultWorkerSettings } from '../config/redis.js';

const connection = createRedisConnection();
const STUDY_IMPORT_QUEUE_NAME = 'study-imports';

export const studyImportQueue = new Queue(STUDY_IMPORT_QUEUE_NAME, { connection });

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
    const result = await processStudyImportJob(job.data.importJobId as string);
    await job.updateProgress(100);
    return result;
  },
  {
    connection,
    ...defaultWorkerSettings,
  }
);

studyImportWorker.on('completed', (job) => {
  console.log(`Study import job ${job.id} completed`);
});

studyImportWorker.on('failed', (job, err) => {
  console.error(`Study import job ${job?.id} failed:`, err);
});
