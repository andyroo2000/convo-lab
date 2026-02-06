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
    console.error('Usage: tsx retry-failed-job.ts <jobId>');
    process.exit(1);
  }

  const job = await courseQueue.getJob(jobId);

  if (!job) {
    console.log(`Job #${jobId} not found`);
    process.exit(1);
  }

  console.log(`Job #${jobId}:`);
  console.log(`  Current state: ${await job.getState()}`);
  console.log(`  Course ID: ${job.data.courseId}`);

  // Retry the job
  console.log(`\nRetrying job...`);
  await job.retry('waiting');

  console.log(`✅ Job #${jobId} moved to waiting state. Worker will process it shortly.`);

  await redis.quit();
}

main().catch(console.error);
