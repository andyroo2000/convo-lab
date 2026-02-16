import { Queue, Worker } from 'bullmq';

import { createRedisConnection, defaultWorkerSettings } from '../config/redis.js';
import { generateDialogue } from '../services/dialogueGenerator.js';

const connection = createRedisConnection();

export const dialogueQueue = new Queue('dialogue-generation', { connection });

// Worker to process dialogue generation jobs
export const dialogueWorker = new Worker(
  'dialogue-generation',
  async (job) => {
    const {
      episodeId,
      speakers,
      variationCount,
      dialogueLength,
      jlptLevel,
      vocabSeedOverride,
      grammarSeedOverride,
    } = job.data;

    try {
      await job.updateProgress(10);

      const result = await generateDialogue({
        episodeId,
        speakers,
        variationCount,
        dialogueLength,
        jlptLevel,
        vocabSeedOverride,
        grammarSeedOverride,
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
    ...defaultWorkerSettings,
  }
);

dialogueWorker.on('completed', (job) => {
  // eslint-disable-next-line no-console
  console.log(`Dialogue job ${job.id} completed`);
});

dialogueWorker.on('failed', (job, err) => {
  // eslint-disable-next-line no-console
  console.error(`Dialogue job ${job?.id} failed:`, err);
});
