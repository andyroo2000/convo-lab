/**
 * Remove specific jobs by ID
 */

import { Queue } from 'bullmq';
import { createRedisConnection } from '../src/config/redis.js';

const jobIds = process.argv.slice(2);

if (jobIds.length === 0) {
  console.error('Usage: remove-jobs.ts <jobId1> [jobId2] [jobId3] ...');
  process.exit(1);
}

async function removeJobs() {
  const connection = createRedisConnection();
  const queue = new Queue('audio-generation', { connection });

  try {
    console.log(`🗑️  Removing ${jobIds.length} job(s)...\n`);

    for (const jobId of jobIds) {
      const job = await queue.getJob(jobId);

      if (!job) {
        console.log(`❌ Job #${jobId} not found`);
        continue;
      }

      const state = await job.getState();
      console.log(`Removing job #${jobId} (${state})...`);

      await job.remove();
      console.log(`✅ Removed job #${jobId}\n`);
    }

    console.log('✅ Done!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await queue.close();
    await connection.quit();
  }
}

removeJobs();
