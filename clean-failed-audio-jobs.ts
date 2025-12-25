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

    console.log('🧹 Cleaning failed audio jobs...\n');

    // Get all failed jobs
    const failedJobs = await audioQueue.getFailed(0, 100);
    console.log(`Found ${failedJobs.length} failed jobs`);

    if (failedJobs.length === 0) {
      console.log('No failed jobs to clean');
      return;
    }

    // Remove all failed jobs
    for (const job of failedJobs) {
      console.log(`Removing job ${job.id}: Episode ${job.data.episodeId}`);
      await job.remove();
    }

    console.log(`\n✅ Removed ${failedJobs.length} failed jobs`);

    // Check queue status after cleanup
    const counts = await audioQueue.getJobCounts(
      'active',
      'waiting',
      'failed',
      'delayed',
      'completed'
    );
    console.log('\n📊 Queue status after cleanup:');
    console.log(`  Active: ${counts.active}`);
    console.log(`  Waiting: ${counts.waiting}`);
    console.log(`  Failed: ${counts.failed}`);
    console.log(`  Delayed: ${counts.delayed}`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await redis.quit();
  }
}

main();
