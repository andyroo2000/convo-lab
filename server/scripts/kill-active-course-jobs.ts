import { Queue } from 'bullmq';
import { createRedisConnection } from '../src/config/redis.js';

async function killJob() {
  const connection = createRedisConnection();
  const queue = new Queue('audio-courses', { connection });

  try {
    // Get all active jobs
    const activeJobs = await queue.getActive();
    console.log(`Found ${activeJobs.length} active jobs`);
    
    for (const job of activeJobs) {
      console.log(`\nJob #${job.id}:`);
      console.log(`  State: ${await job.getState()}`);
      console.log(`  Data:`, JSON.stringify(job.data, null, 2));
      
      // Kill it
      console.log(`\nKilling job #${job.id}...`);
      await job.remove();
      console.log(`✅ Killed job #${job.id}`);
    }
    
    if (activeJobs.length === 0) {
      console.log('No active jobs found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await queue.close();
    await connection.quit();
  }
}

killJob();
