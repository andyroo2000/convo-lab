import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const redis = new IORedis({
  host: 'bursting-flounder-33054.upstash.io',
  port: 6379,
  password: 'AYEeAAIncDIyMzc1ZGNjZDc0NGE0MjNlODIxNjllZTQyMzY3NTk4NnAyMzMwNTQ',
  maxRetriesPerRequest: null,
  tls: {},
});

async function main() {
  try {
    const dialogueQueue = new Queue('dialogue-generation', { connection: redis });

    console.log('📊 Dialogue queue status:');
    const counts = await dialogueQueue.getJobCounts(
      'active',
      'waiting',
      'failed',
      'delayed',
      'completed'
    );
    console.log(`  Active: ${counts.active}`);
    console.log(`  Waiting: ${counts.waiting}`);
    console.log(`  Failed: ${counts.failed}`);
    console.log(`  Delayed: ${counts.delayed}`);
    console.log(`  Completed (recent): ${counts.completed}`);

    // Check specific job 24
    const job24 = await dialogueQueue.getJob('24');
    if (job24) {
      console.log('\n🔍 Job 24 details:');
      console.log(`  State: ${await job24.getState()}`);
      console.log(`  Data:`, job24.data);
      console.log(`  Progress: ${job24.progress}`);
      if (job24.failedReason) {
        console.log(`  Failed reason: ${job24.failedReason}`);
      }
      if (job24.returnvalue) {
        console.log(`  Return value:`, job24.returnvalue);
      }
    } else {
      console.log('\n❌ Job 24 not found in queue');
    }

    // Get recent jobs
    console.log('\n🔍 Recent jobs:');
    const activeJobs = await dialogueQueue.getActive(0, 5);
    const waitingJobs = await dialogueQueue.getWaiting(0, 5);
    const failedJobs = await dialogueQueue.getFailed(0, 5);

    if (activeJobs.length > 0) {
      console.log('\nActive jobs:');
      for (const job of activeJobs) {
        console.log(`  Job ${job.id}: ${await job.getState()}`);
        console.log(`    Data:`, job.data);
      }
    }

    if (waitingJobs.length > 0) {
      console.log('\nWaiting jobs:');
      for (const job of waitingJobs) {
        console.log(`  Job ${job.id}: ${await job.getState()}`);
      }
    }

    if (failedJobs.length > 0) {
      console.log('\nFailed jobs:');
      for (const job of failedJobs) {
        console.log(`  Job ${job.id}: ${await job.getState()}`);
        console.log(`    Failed reason: ${job.failedReason}`);
      }
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await redis.quit();
  }
}

main();
