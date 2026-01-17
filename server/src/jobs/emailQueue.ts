/* eslint-disable no-console */
// Console logging is necessary for email queue monitoring
import { Queue, Worker } from 'bullmq';

import { createRedisConnection, defaultWorkerSettings } from '../config/redis.js';
import { sendVerificationEmail } from '../services/emailService.js';

const connection = createRedisConnection();

export const emailQueue = new Queue('email-sending', { connection });

export const emailWorker = new Worker(
  'email-sending',
  async (job) => {
    const { type, userId, email, name } = job.data;

    try {
      if (type === 'verification') {
        await sendVerificationEmail(userId, email, name);
        return { success: true, email, type };
      }

      throw new Error(`Unknown email type: ${type}`);
    } catch (error) {
      console.error(`[EMAIL-WORKER] Email failed: ${email} (${type})`, error);
      throw error;
    }
  },
  {
    connection,
    ...defaultWorkerSettings,
  }
);

emailWorker.on('completed', (job) => {
  console.log(`[EMAIL-WORKER] Email sent: ${job.data.email} (${job.data.type})`);
});

emailWorker.on('failed', (job, err) => {
  console.error(
    `[EMAIL-WORKER] Email failed after retries: ${job?.data.email} (${job?.data.type})`,
    err
  );
});
