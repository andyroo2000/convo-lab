import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { generateEpisodeAudio } from '../services/audioGenerator.js';

const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  enableOfflineQueue: false,
  // Enable TLS for Upstash
  tls: process.env.REDIS_HOST?.includes('upstash.io') ? {} : undefined,
});

export const audioQueue = new Queue('audio-generation', { connection });

export const audioWorker = new Worker(
  'audio-generation',
  async (job) => {
    const { userId, episodeId, dialogueId, speed, pauseMode } = job.data;

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
  },
  { connection }
);

audioWorker.on('completed', (job) => {
  console.log(`Audio job ${job.id} completed`);
});

audioWorker.on('failed', (job, err) => {
  console.error(`Audio job ${job?.id} failed:`, err);
});
