import { Queue, Worker } from 'bullmq';

import { createRedisConnection, defaultWorkerSettings } from '../config/redis.js';
import { generateAudioScriptSegmentImages } from '../services/audioScriptService.js';
import { generateDialogueImages } from '../services/imageGenerator.js';

const connection = createRedisConnection();

export const imageQueue = new Queue('image-generation', { connection });

export const imageWorker = new Worker(
  'image-generation',
  async (job) => {
    const { episodeId, dialogueId, imageCount, userId, force } = job.data;

    try {
      await job.updateProgress(10);

      if (job.name === 'generate-script-images') {
        if (!episodeId || !userId) {
          throw new Error('Script image generation requires episodeId and userId');
        }

        return generateAudioScriptSegmentImages({
          episodeId,
          userId,
          force,
          onProgress: (progress) => job.updateProgress(progress),
        });
      }

      const result = await generateDialogueImages({
        episodeId,
        dialogueId,
        imageCount,
      });

      await job.updateProgress(100);

      return result;
    } catch (error) {
      console.error('Image generation failed:', error);
      throw error;
    }
  },
  {
    connection,
    ...defaultWorkerSettings,
  }
);

imageWorker.on('completed', (job) => {
  // eslint-disable-next-line no-console
  console.log(`Image job ${job.id} completed`);
});

imageWorker.on('failed', (job, err) => {
  // eslint-disable-next-line no-console
  console.error(`Image job ${job?.id} failed:`, err);
});
