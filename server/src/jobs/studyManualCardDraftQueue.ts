/* eslint-disable no-console */
import { Queue, Worker } from 'bullmq';

import { createRedisConnection, defaultWorkerSettings } from '../config/redis.js';
import { processManualCardDraft } from '../services/study/manualCardDrafts.js';

const connection = createRedisConnection();
const STUDY_MANUAL_CARD_DRAFT_QUEUE_NAME = 'study-manual-card-drafts';

export const studyManualCardDraftQueue = new Queue(STUDY_MANUAL_CARD_DRAFT_QUEUE_NAME, {
  connection,
});

function parseStudyManualCardDraftJobData(data: unknown): { draftId: string } {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid manual card draft job payload.');
  }

  const record = data as Record<string, unknown>;
  if (typeof record.draftId !== 'string' || record.draftId.trim().length === 0) {
    throw new Error('Invalid manual card draft job payload.');
  }

  return { draftId: record.draftId.trim() };
}

export async function enqueueStudyManualCardDraftJob(draftId: string) {
  const existingJob = await studyManualCardDraftQueue.getJob(draftId);
  if (existingJob) {
    const state = await existingJob.getState();
    if (state === 'active' || state === 'waiting' || state === 'delayed') {
      return existingJob;
    }
    await existingJob.remove();
  }

  return studyManualCardDraftQueue.add(
    'complete-manual-card-draft',
    { draftId },
    {
      jobId: draftId,
      // The processor persists provider failures onto the draft as user-visible error state,
      // so BullMQ retries would duplicate side effects without improving recovery. Vocab bundle
      // drafts defer that persistence until the final attempt because one job owns many drafts.
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

export const studyManualCardDraftWorker = new Worker(
  STUDY_MANUAL_CARD_DRAFT_QUEUE_NAME,
  async (job) => {
    if (job.name !== 'complete-manual-card-draft') {
      throw new Error(`Unsupported manual card draft job "${job.name}".`);
    }

    const { draftId } = parseStudyManualCardDraftJobData(job.data);
    const result = await processManualCardDraft(draftId);
    await job.updateProgress(100);
    return result;
  },
  {
    connection,
    ...defaultWorkerSettings,
  }
);

studyManualCardDraftWorker.on('completed', (job) => {
  console.log(`Manual card draft job ${job.id} completed`);
});

studyManualCardDraftWorker.on('failed', (job, err) => {
  console.error(`Manual card draft job ${job?.id} failed:`, err);
});
