/**
 * Clean up duplicate waiting jobs from the Redis queue
 */

import { Queue } from 'bullmq';
import { createRedisConnection } from '../src/config/redis.js';

async function cleanupDuplicates() {
  const connection = createRedisConnection();
  const queue = new Queue('audio-generation', { connection });

  try {
    console.log('🧹 Cleaning up duplicate jobs...\n');

    // Get all waiting jobs
    const waitingJobs = await queue.getJobs(['waiting']);
    console.log(`Found ${waitingJobs.length} waiting jobs\n`);

    // Group jobs by episodeId+dialogueId
    const jobsByEpisode = new Map<string, any[]>();

    for (const job of waitingJobs) {
      if (job.name === 'generate-all-speeds') {
        const key = `${job.data.episodeId}:${job.data.dialogueId}`;
        const existing = jobsByEpisode.get(key) || [];
        existing.push(job);
        jobsByEpisode.set(key, existing);
      }
    }

    // Find and remove duplicates (keep the oldest job)
    let removedCount = 0;

    for (const [key, jobs] of jobsByEpisode.entries()) {
      if (jobs.length > 1) {
        console.log(`📋 Episode ${key.split(':')[0]}: ${jobs.length} duplicate jobs`);

        // Sort by timestamp (oldest first)
        jobs.sort((a, b) => a.timestamp - b.timestamp);

        // Keep the first (oldest), remove the rest
        const toKeep = jobs[0];
        const toRemove = jobs.slice(1);

        console.log(`   ✅ Keeping job #${toKeep.id} (created: ${new Date(toKeep.timestamp).toISOString()})`);

        for (const job of toRemove) {
          await job.remove();
          console.log(`   ❌ Removed job #${job.id} (created: ${new Date(job.timestamp).toISOString()})`);
          removedCount++;
        }

        console.log('');
      }
    }

    console.log('━'.repeat(60));
    console.log(`✅ Cleanup complete!`);
    console.log(`   Removed ${removedCount} duplicate jobs`);
    console.log(`   Remaining waiting jobs: ${waitingJobs.length - removedCount}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await queue.close();
    await connection.quit();
  }
}

cleanupDuplicates();
