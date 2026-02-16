import { Queue, Worker } from 'bullmq';

import { createRedisConnection, defaultWorkerSettings } from '../config/redis.js';
import { generateEpisodeAudio, generateAllSpeedsAudio } from '../services/audioGenerator.js';

const connection = createRedisConnection();

export const audioQueue = new Queue('audio-generation', { connection });

export const audioWorker = new Worker(
  'audio-generation',
  async (job) => {
    // Handle different job types
    if (job.name === 'generate-all-speeds') {
      const { episodeId, dialogueId } = job.data;

      try {
        const result = await generateAllSpeedsAudio(episodeId, dialogueId, (progress) => {
          job.updateProgress(progress);
        });

        return result;
      } catch (error) {
        console.error('Multi-speed audio generation failed:', error);
        throw error;
      }
    } else {
      // Legacy single-speed generation
      const { episodeId, dialogueId, speed, pauseMode } = job.data;

      try {
        await job.updateProgress(10);

        const result = await generateEpisodeAudio({
          episodeId,
          dialogueId,
          speed,
          pauseMode,
        });

        await job.updateProgress(100);

        return result;
      } catch (error) {
        console.error('Audio generation failed:', error);
        throw error;
      }
    }
  },
  {
    connection,
    ...defaultWorkerSettings,
  }
);

audioWorker.on('completed', (job) => {
  // eslint-disable-next-line no-console
  console.log(`Audio job ${job.id} completed`);
});

audioWorker.on('failed', (job, err) => {
  // eslint-disable-next-line no-console
  console.error(`Audio job ${job?.id} failed:`, err);
});
