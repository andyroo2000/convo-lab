import { Queue, Worker } from 'bullmq';
import { generateDialogueImages } from '../services/imageGenerator.js';
import { createRedisConnection, defaultWorkerSettings } from '../config/redis.js';

const connection = createRedisConnection();

export const imageQueue = new Queue('image-generation', { connection });

export const imageWorker = new Worker(
  'image-generation',
  async (job) => {
    const { userId, episodeId, dialogueId, imageCount } = job.data;

    try {
      await job.updateProgress(10);

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
  console.log(`Image job ${job.id} completed`);
});

imageWorker.on('failed', (job, err) => {
  console.error(`Image job ${job?.id} failed:`, err);
});
