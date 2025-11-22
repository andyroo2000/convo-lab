/**
 * Check job status in Redis (production or local)
 */

import { Queue } from 'bullmq';
import { createRedisConnection } from '../src/config/redis.js';

const jobId = process.argv[2];

if (!jobId) {
  console.error('Usage: check-redis-job.ts <jobId>');
  process.exit(1);
}

async function checkJob() {
  const connection = createRedisConnection();
  const queue = new Queue('audio-generation', { connection });

  try {
    console.log(`🔍 Checking job ${jobId} in Redis...`);
    console.log(`   Redis: ${process.env.REDIS_HOST || 'localhost'}\n`);

    const job = await queue.getJob(jobId);

    if (!job) {
      console.log(`❌ Job ${jobId} not found in queue`);

      // Try to get job counts to see overall queue status
      const counts = await queue.getJobCounts();
      console.log('\n📊 Queue status:');
      console.log(`   Active: ${counts.active}`);
      console.log(`   Waiting: ${counts.waiting}`);
      console.log(`   Completed: ${counts.completed}`);
      console.log(`   Failed: ${counts.failed}`);
      console.log(`   Delayed: ${counts.delayed}`);
    } else {
      const state = await job.getState();

      console.log(`📋 Job #${job.id}:`);
      console.log(`   Name: ${job.name}`);
      console.log(`   State: ${state}`);
      console.log(`   Progress: ${job.progress}`);
      console.log(`   Data:`, JSON.stringify(job.data, null, 2));
      console.log(`   Created: ${new Date(job.timestamp).toISOString()}`);

      if (job.processedOn) {
        console.log(`   Processed: ${new Date(job.processedOn).toISOString()}`);
      }
      if (job.finishedOn) {
        console.log(`   Finished: ${new Date(job.finishedOn).toISOString()}`);
      }

      if (state === 'failed' && job.failedReason) {
        console.log(`   ❌ Failed reason: ${job.failedReason}`);
        console.log(`   Stack:`, job.stacktrace);
      }

      if (state === 'completed' && job.returnvalue) {
        console.log(`   ✅ Result:`, job.returnvalue);
      }
    }

    // Get recent jobs
    console.log('\n📜 Recent jobs:');
    const jobs = await queue.getJobs(['active', 'waiting', 'completed', 'failed'], 0, 10);

    for (const j of jobs.reverse()) {
      const s = await j.getState();
      const emoji = s === 'completed' ? '✅' : s === 'failed' ? '❌' : s === 'active' ? '⏳' : '⏸️';
      console.log(`${emoji} #${j.id} - ${j.name} (${s}) - Episode: ${j.data.episodeId}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await queue.close();
    await connection.quit();
  }
}

checkJob();
