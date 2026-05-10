import { Queue, Worker } from 'bullmq';

import { createRedisConnection, defaultWorkerSettings } from '../config/redis.js';
import { logger } from '../services/logger.js';
import {
  processStudyVocabBundleDrafts,
  VocabBundleDraftMismatchError,
} from '../services/studyVocabBundleService.js';

const queueConnection = createRedisConnection();
const workerConnection = createRedisConnection();
const STUDY_VOCAB_BUNDLE_DRAFT_QUEUE_NAME = 'study-vocab-bundle-drafts';
const STUDY_VOCAB_BUNDLE_DRAFT_JOB_ATTEMPTS = 3;
const ACTIVE_JOB_STATES = new Set([
  'active',
  'waiting',
  'delayed',
  'prioritized',
  // Forward-compatible with BullMQ flow jobs if this queue ever gains child work.
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
      logger.warn(
        `Vocab bundle draft job ${groupId} has already failed; leaving historical job in place.`
      );
      return existingJob;
    }
    if (state === 'completed') {
      // Group IDs are per-creation UUIDs, so finished jobs are historical records, not requeue targets.
      return existingJob;
    }
    if (state === 'unknown') {
      logger.warn(`Vocab bundle draft job ${groupId} has unknown BullMQ state; leaving it alone.`);
      // If an unknown job is truly lost, an operator can re-enqueue after inspecting Redis state.
      return existingJob;
    }
    // Keep future BullMQ states stable instead of removing a job a worker might still observe.
    return existingJob;
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
    const shouldMarkDraftsOnError = job.attemptsMade + 1 >= attempts;
    let result: Awaited<ReturnType<typeof processStudyVocabBundleDrafts>>;
    try {
      result = await processStudyVocabBundleDrafts(groupId, {
        markDraftsOnError: shouldMarkDraftsOnError,
      });
    } catch (error) {
      if (error instanceof VocabBundleDraftMismatchError) {
        try {
          await job.discard();
        } catch (discardError) {
          logger.warn(
            'Failed to discard non-retryable vocab bundle draft job; BullMQ may retry it.',
            discardError
          );
        }
      }
      throw error;
    }
    await job.updateProgress(100);
    return result;
  },
  {
    connection: workerConnection,
    ...defaultWorkerSettings,
  }
);

studyVocabBundleDraftWorker.on('completed', (job) => {
  logger.info(`Vocab bundle draft job ${job.id} completed`);
});

studyVocabBundleDraftWorker.on('failed', (job, err) => {
  logger.error(`Vocab bundle draft job ${job?.id} failed:`, err);
});
