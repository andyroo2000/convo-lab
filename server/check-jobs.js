import { Queue } from 'bullmq';
import Redis from 'ioredis';

const connection = new Redis({
  maxRetriesPerRequest: null,
});

const queue = new Queue('chunk-pack-queue', { connection });

async function checkJobs() {
  try {
    const failed = await queue.getFailed();
    console.log(`Failed jobs: ${failed.length}`);

    if (failed.length > 0) {
      const job = failed[0];
      console.log('\nLatest failed job:');
      console.log('ID:', job.id);
      console.log('Data:', JSON.stringify(job.data, null, 2));
      console.log('Error:', job.failedReason);
      console.log('Stack trace:', job.stacktrace);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await queue.close();
    await connection.quit();
  }
}

checkJobs();
