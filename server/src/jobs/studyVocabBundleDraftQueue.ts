/* eslint-disable no-console */
import { Queue, Worker } from 'bullmq';

import { createRedisConnection, defaultWorkerSettings } from '../config/redis.js';
import { processStudyVocabBundleDrafts } from '../services/studyVocabBundleService.js';

const queueConnection = createRedisConnection();
const workerConnection = createRedisConnection();
const STUDY_VOCAB_BUNDLE_DRAFT_QUEUE_NAME = 'study-vocab-bundle-drafts';
const STUDY_VOCAB_BUNDLE_DRAFT_JOB_ATTEMPTS = 3;
const ACTIVE_JOB_STATES = new Set([
  'active',
  'waiting',
  'delayed',
  'prioritized',
  'waiting-children',
]);

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
    if (ACTIVE_JOB_STATES.has(state)) {
      return existingJob;
    }
    if (state === 'failed') {
      // A failed job has exhausted its attempt budget; recreate it so a manual retry gets a fresh window.
      await existingJob.remove();
    } else if (state === 'completed') {
      // Group IDs are per-creation UUIDs, so finished jobs are historical records, not requeue targets.
      return existingJob;
    } else {
      if (state === 'unknown') {
        console.warn(
          `Vocab bundle draft job ${groupId} has unknown BullMQ state; leaving it alone.`
        );
      }
      // Keep future BullMQ states stable instead of removing a job a worker might still observe.
      return existingJob;
    }
  }

  return studyVocabBundleDraftQueue.add(
    'complete-vocab-bundle-drafts',
    { groupId },
    {
      jobId: groupId,
      attempts: STUDY_VOCAB_BUNDLE_DRAFT_JOB_ATTEMPTS,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
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
    const attempts =
      typeof job.opts.attempts === 'number'
        ? job.opts.attempts
        : STUDY_VOCAB_BUNDLE_DRAFT_JOB_ATTEMPTS;
    const result = await processStudyVocabBundleDrafts(groupId, {
      markDraftsOnError: job.attemptsMade + 1 >= attempts,
    });
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
