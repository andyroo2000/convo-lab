import { Queue } from 'bullmq';
import { createRedisConnection } from '../src/config/redis.js';

async function main() {
  const connection = createRedisConnection();
  const audioQueue = new Queue('audio-generation', { connection });

  // Get queue stats
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    audioQueue.getWaitingCount(),
    audioQueue.getActiveCount(),
    audioQueue.getCompletedCount(),
    audioQueue.getFailedCount(),
    audioQueue.getDelayedCount(),
  ]);

  console.log('\n📊 Audio-Generation Queue Status:');
  console.log(`  Waiting: ${waiting}`);
  console.log(`  Active: ${active}`);
  console.log(`  Completed: ${completed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Delayed: ${delayed}`);

  // Get failed jobs
  if (failed > 0) {
    console.log('\n❌ Recent Failed Jobs:');
    const failedJobs = await audioQueue.getFailed(0, 5);
    for (const job of failedJobs) {
      console.log(`\nJob #${job.id}:`);
      console.log(`  Name: ${job.name}`);
      console.log(`  Data:`, JSON.stringify(job.data, null, 2));
      console.log(`  Failed Reason: ${job.failedReason}`);
      if (job.stacktrace && job.stacktrace.length > 0) {
        console.log(`  Stack Trace:`, job.stacktrace[0].substring(0, 1000));
      }
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

  // Get completed jobs
  if (completed > 0) {
    console.log('\n✅ Recent Completed Jobs:');
    const completedJobs = await audioQueue.getCompleted(0, 5);
    for (const job of completedJobs) {
      console.log(`\nJob #${job.id}:`);
      console.log(`  Name: ${job.name}`);
      console.log(`  Data:`, JSON.stringify(job.data, null, 2));
    }
  }

  await audioQueue.close();
  await connection.quit();
}

main().catch(console.error);
