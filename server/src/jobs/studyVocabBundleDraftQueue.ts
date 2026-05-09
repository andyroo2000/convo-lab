/* eslint-disable no-console */
import { Queue, Worker } from 'bullmq';

import { createRedisConnection, defaultWorkerSettings } from '../config/redis.js';
import { processStudyVocabBundleDrafts } from '../services/studyVocabBundleService.js';

const queueConnection = createRedisConnection();
const workerConnection = createRedisConnection();
const STUDY_VOCAB_BUNDLE_DRAFT_QUEUE_NAME = 'study-vocab-bundle-drafts';

export const studyVocabBundleDraftQueue = new Queue(STUDY_VOCAB_BUNDLE_DRAFT_QUEUE_NAME, {
  connection: queueConnection,
});

function parseStudyVocabBundleDraftJobData(data: unknown): { groupId: string } {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid vocab bundle draft job payload.');
  }

  const record = data as Record<string, unknown>;
  if (typeof record.groupId !== 'string' || record.groupId.trim().length === 0) {
    throw new Error('Invalid vocab bundle draft job payload.');
  }

  return { groupId: record.groupId.trim() };
}

export async function enqueueStudyVocabBundleDraftJob(groupId: string) {
  const existingJob = await studyVocabBundleDraftQueue.getJob(groupId);
  if (existingJob) {
    const state = await existingJob.getState();
    if (state === 'active' || state === 'waiting' || state === 'delayed') {
      return existingJob;
    }
    await existingJob.remove();
  }

  return studyVocabBundleDraftQueue.add(
    'complete-vocab-bundle-drafts',
    { groupId },
    {
      jobId: groupId,
      attempts: 1,
      removeOnComplete: {
        age: 60 * 60,
        count: 50,
      },
      removeOnFail: {
        age: 24 * 60 * 60,
        count: 50,
      },
    }
  );
}

export const studyVocabBundleDraftWorker = new Worker(
  STUDY_VOCAB_BUNDLE_DRAFT_QUEUE_NAME,
  async (job) => {
    if (job.name !== 'complete-vocab-bundle-drafts') {
      throw new Error(`Unsupported vocab bundle draft job "${job.name}".`);
    }

    const { groupId } = parseStudyVocabBundleDraftJobData(job.data);
    const result = await processStudyVocabBundleDrafts(groupId);
    await job.updateProgress(100);
    return result;
  },
  {
    connection: workerConnection,
    ...defaultWorkerSettings,
  }
);

studyVocabBundleDraftWorker.on('completed', (job) => {
  console.log(`Vocab bundle draft job ${job.id} completed`);
});

studyVocabBundleDraftWorker.on('failed', (job, err) => {
  console.error(`Vocab bundle draft job ${job?.id} failed:`, err);
});
