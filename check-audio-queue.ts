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
    const audioQueue = new Queue('audio-generation', { connection: redis });

    console.log('📊 Audio queue status:');
    const counts = await audioQueue.getJobCounts(
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

    console.log('\n🔍 Recent jobs:');
    const recentJobs = await audioQueue.getJobs(['active', 'waiting', 'failed'], 0, 10);

    if (recentJobs.length === 0) {
      console.log('  No jobs found in active, waiting, or failed states');
    } else {
      for (const job of recentJobs) {
        const state = await job.getState();
        console.log(`\n  Job ${job.id}:`);
        console.log(`    State: ${state}`);
        console.log(`    Episode ID: ${job.data.episodeId || 'N/A'}`);
        console.log(`    Speed: ${job.data.speed || 'N/A'}`);
        if (job.failedReason) {
          console.log(`    Failed reason: ${job.failedReason}`);
        }
      }
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await redis.quit();
  }
}

main();
