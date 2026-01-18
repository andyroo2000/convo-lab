import { Queue } from 'bullmq';
import { createRedisConnection } from '../src/config/redis.js';

async function main() {
  const connection = createRedisConnection();
  const audioQueue = new Queue('audio', { connection });

  // Get queue stats
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    audioQueue.getWaitingCount(),
    audioQueue.getActiveCount(),
    audioQueue.getCompletedCount(),
    audioQueue.getFailedCount(),
    audioQueue.getDelayedCount(),
  ]);

  console.log('\n📊 Audio Queue Status:');
  console.log(`  Waiting: ${waiting}`);
  console.log(`  Active: ${active}`);
  console.log(`  Completed: ${completed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Delayed: ${delayed}`);

  // Get failed jobs
  if (failed > 0) {
    console.log('\n❌ Recent Failed Jobs:');
    const failedJobs = await audioQueue.getFailed(0, 10);
    for (const job of failedJobs) {
      console.log(`\nJob #${job.id}:`);
      console.log(`  Name: ${job.name}`);
      console.log(`  Data:`, JSON.stringify(job.data, null, 2));
      console.log(`  Failed Reason: ${job.failedReason}`);
      console.log(`  Stack Trace:`, job.stacktrace?.slice(0, 500));
    }
  }

  // Get waiting jobs
  if (waiting > 0) {
    console.log('\n⏳ Waiting Jobs:');
    const waitingJobs = await audioQueue.getWaiting(0, 10);
    for (const job of waitingJobs) {
      console.log(`\nJob #${job.id}:`);
      console.log(`  Name: ${job.name}`);
      console.log(`  Data:`, JSON.stringify(job.data, null, 2));
    }
  }

  await audioQueue.close();
  await connection.quit();
}

main().catch(console.error);
