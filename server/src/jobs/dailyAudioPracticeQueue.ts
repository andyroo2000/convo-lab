import { Queue, Worker } from 'bullmq';

import { createRedisConnection, defaultWorkerSettings } from '../config/redis.js';
import { processDailyAudioPracticeJob } from '../services/dailyAudioPractice/generationService.js';

const connection = createRedisConnection();

export const dailyAudioPracticeQueue = new Queue('daily-audio-practice-generation', {
  connection,
});

export async function enqueueDailyAudioPracticeJob(practiceId: string) {
  const existingJob = await dailyAudioPracticeQueue.getJob(practiceId);
  if (existingJob) {
    const state = await existingJob.getState();
    if (state === 'active' || state === 'waiting' || state === 'delayed') {
      return existingJob;
    }
    await existingJob.remove();
  }

  return dailyAudioPracticeQueue.add(
    'generate-daily-audio-practice',
    { practiceId },
    {
      jobId: practiceId,
      attempts: 2,
      removeOnComplete: {
        age: 60 * 60,
        count: 20,
      },
      removeOnFail: {
        age: 24 * 60 * 60,
        count: 50,
      },
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    }
  );
}

export const dailyAudioPracticeWorker = new Worker(
  'daily-audio-practice-generation',
  async (job) => {
    const practiceId = typeof job.data?.practiceId === 'string' ? job.data.practiceId : '';
    if (!practiceId) {
      throw new Error('Invalid daily audio practice job payload');
    }

    return processDailyAudioPracticeJob({
      practiceId,
      onProgress: async (progress) => {
        await job.updateProgress(progress);
      },
    });
  },
  {
    connection,
    ...defaultWorkerSettings,
  }
);

dailyAudioPracticeWorker.on('completed', (job) => {
  // eslint-disable-next-line no-console
  console.log(`Daily audio practice job ${job.id} completed`);
});

dailyAudioPracticeWorker.on('failed', (job, err) => {
  // eslint-disable-next-line no-console
  console.error(`Daily audio practice job ${job?.id} failed:`, err);
});
