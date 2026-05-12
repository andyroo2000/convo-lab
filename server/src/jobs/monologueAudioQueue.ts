/* eslint-disable no-console */
import { Queue, Worker } from 'bullmq';

import { createRedisConnection, defaultWorkerSettings } from '../config/redis.js';
import {
  generateMonologueFullAudioTake,
  markMonologueFullAudioRenderFailed,
} from '../services/monologueService.js';

const queueConnection = createRedisConnection();
const workerConnection = createRedisConnection();
const MONOLOGUE_FULL_AUDIO_QUEUE_NAME = 'monologue-full-audio-render';

export interface MonologueFullAudioRenderJobData {
  projectId: string;
  scriptVersionId: string;
  userId: string;
}

export const monologueAudioQueue = new Queue(MONOLOGUE_FULL_AUDIO_QUEUE_NAME, {
  connection: queueConnection,
});

function parseMonologueFullAudioRenderJobData(data: unknown): MonologueFullAudioRenderJobData {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid monologue full-audio render job payload.');
  }

  const record = data as Record<string, unknown>;
  const projectId = typeof record.projectId === 'string' ? record.projectId.trim() : '';
  const scriptVersionId =
    typeof record.scriptVersionId === 'string' ? record.scriptVersionId.trim() : '';
  const userId = typeof record.userId === 'string' ? record.userId.trim() : '';
  if (!projectId || !scriptVersionId || !userId) {
    throw new Error('Invalid monologue full-audio render job payload.');
  }

  return { projectId, scriptVersionId, userId };
}

export async function enqueueMonologueFullAudioRenderJob(data: MonologueFullAudioRenderJobData) {
  return monologueAudioQueue.add('render-full-audio', data, {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: 50,
    removeOnFail: 50,
  });
}

export const monologueAudioWorker = new Worker(
  MONOLOGUE_FULL_AUDIO_QUEUE_NAME,
  async (job) => {
    if (job.name !== 'render-full-audio') {
      throw new Error(`Unsupported monologue audio job "${job.name}".`);
    }

    const data = parseMonologueFullAudioRenderJobData(job.data);
    try {
      const result = await generateMonologueFullAudioTake(data.userId, data.projectId, {
        expectedScriptVersionId: data.scriptVersionId,
      });
      await job.updateProgress(100);
      return result;
    } catch (error) {
      await markMonologueFullAudioRenderFailed(data.userId, data.projectId, data.scriptVersionId);
      throw error;
    }
  },
  {
    connection: workerConnection,
    ...defaultWorkerSettings,
  }
);

monologueAudioWorker.on('completed', (job) => {
  console.log(`Monologue full-audio render job ${job.id} completed`);
});

monologueAudioWorker.on('failed', (job, err) => {
  console.error(`Monologue full-audio render job ${job?.id} failed:`, err);
});
