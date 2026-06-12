import { Queue, Worker } from 'bullmq';

import { createRedisConnection, defaultWorkerSettings } from '../config/redis.js';
import { processAudioScriptRenderJob } from '../services/audioScriptService.js';

const connection = createRedisConnection();

export const audioScriptQueue = new Queue('audio-script-rendering', { connection });

export const audioScriptWorker = new Worker(
  'audio-script-rendering',
  async (job) => {
    const { episodeId, userId } = job.data;

    if (!episodeId || !userId) {
      throw new Error('Audio script render job requires episodeId and userId');
    }

    return processAudioScriptRenderJob({
      episodeId,
      userId,
      onProgress: (progress) => job.updateProgress(progress),
    });
  },
  {
    connection,
    ...defaultWorkerSettings,
  }
);

audioScriptWorker.on('completed', (job) => {
  // eslint-disable-next-line no-console
  console.log(`Audio script job ${job.id} completed`);
});

audioScriptWorker.on('failed', (job, err) => {
  // eslint-disable-next-line no-console
  console.error(`Audio script job ${job?.id} failed:`, err);
});
