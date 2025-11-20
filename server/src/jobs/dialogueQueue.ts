import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { generateDialogue } from '../services/dialogueGenerator.js';

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

export const dialogueQueue = new Queue('dialogue-generation', { connection });

// Worker to process dialogue generation jobs
export const dialogueWorker = new Worker(
  'dialogue-generation',
  async (job) => {
    const { userId, episodeId, speakers, variationCount, dialogueLength } = job.data;

    try {
      await job.updateProgress(10);

      const result = await generateDialogue({
        episodeId,
        speakers,
        variationCount,
        dialogueLength,
      });

      await job.updateProgress(100);

      return result;
    } catch (error) {
      console.error('Dialogue generation failed:', error);
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

dialogueWorker.on('completed', (job) => {
  console.log(`Dialogue job ${job.id} completed`);
});

dialogueWorker.on('failed', (job, err) => {
  console.error(`Dialogue job ${job?.id} failed:`, err);
});
