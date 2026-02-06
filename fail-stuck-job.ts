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
  const jobId = process.argv[2];

  if (!jobId) {
    console.error('Usage: tsx fail-stuck-job.ts <jobId>');
    process.exit(1);
  }

  const job = await courseQueue.getJob(jobId);

  if (!job) {
    console.log(`Job #${jobId} not found`);
    process.exit(1);
  }

  console.log(`Job #${jobId}:`);
  console.log(`  Current state: ${await job.getState()}`);
  console.log(`  Progress: ${job.progress}%`);
  console.log(`  Course ID: ${job.data.courseId}`);

  // Manually fail the job so it can retry
  console.log(`\nManually failing job to force retry...`);
  await job.moveToFailed(new Error('Manually failed to retry with new worker code'), '0');

  console.log(`✅ Job #${jobId} moved to failed state. It will retry shortly.`);

  await redis.quit();
}

main().catch(console.error);
