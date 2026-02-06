#!/usr/bin/env tsx
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const redis = new IORedis({
  host: 'bursting-flounder-33054.upstash.io',
  port: 6379,
  password: 'AYEeAAIncDIyMzc1ZGNjZDc0NGE0MjNlODIxNjllZTQyMzY3NTk4NnAyMzMwNTQ',
  maxRetriesPerRequest: null,
  tls: {},
});

const courseQueue = new Queue('course-generation', { connection: redis });

async function main() {
  const jobId = process.argv[2] || '178';

  const job = await courseQueue.getJob(jobId);

  if (!job) {
    console.log(`Job #${jobId} not found`);
  } else {
    console.log(`\nJob #${jobId}:`);
    console.log(`  State: ${await job.getState()}`);
    console.log(`  Course ID: ${job.data.courseId}`);
    console.log(`  Progress: ${job.progress}%`);
    console.log(`  Attempts: ${job.attemptsMade}/${job.opts.attempts || 'unlimited'}`);
    console.log(`  Created: ${new Date(job.timestamp).toISOString()}`);
    console.log(`  Processed: ${job.processedOn ? new Date(job.processedOn).toISOString() : 'not yet'}`);
    console.log(`  Finished: ${job.finishedOn ? new Date(job.finishedOn).toISOString() : 'not yet'}`);

    if (job.failedReason) {
      console.log(`  Failed reason: ${job.failedReason}`);
    }

    if (job.stacktrace && job.stacktrace.length > 0) {
      console.log(`  Stack trace: ${job.stacktrace[0].substring(0, 200)}...`);
    }
  }

  // Also show queue counts
  const counts = await courseQueue.getJobCounts();
  console.log(`\nQueue counts:`);
  console.log(`  Waiting: ${counts.waiting}`);
  console.log(`  Active: ${counts.active}`);
  console.log(`  Completed: ${counts.completed}`);
  console.log(`  Failed: ${counts.failed}`);
  console.log(`  Delayed: ${counts.delayed}`);

  await redis.quit();
}

main().catch(console.error);
