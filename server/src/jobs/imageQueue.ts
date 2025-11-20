import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { generateDialogueImages } from '../services/imageGenerator.js';

const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  enableOfflineQueue: true, // Changed: allow queuing commands when offline
  // Enable TLS for Upstash
  tls: process.env.REDIS_HOST?.includes('upstash.io') ? {} : undefined,
});

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
    settings: {
      // Reduce polling to conserve Redis requests
      stalledInterval: 60000, // Check for stalled jobs every 60s (default: 30s)
      maxStalledCount: 2,
    },
  }
);

imageWorker.on('completed', (job) => {
  console.log(`Image job ${job.id} completed`);
});

imageWorker.on('failed', (job, err) => {
  console.error(`Image job ${job?.id} failed:`, err);
});
