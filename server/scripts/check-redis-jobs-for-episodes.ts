import { Queue } from 'bullmq';
import Redis from 'ioredis';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Load production environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../', '.env.production'), override: true });

const redis = new Redis({
  host: process.env.REDIS_HOST!,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD!,
  maxRetriesPerRequest: null,
});

const dialogueQueue = new Queue('dialogue-generation', { connection: redis });

const episodeIds = [
  'b6e14eb1-25bd-449c-a6c2-317bc223c88f', // "Generating dialogue..."
  '92d36994-1567-4602-8815-3e68fb21c98c', // "Conversation with flight attendants..."
];

async function checkJobs() {
  try {
    console.log('🔍 Checking Redis jobs for draft episodes...\n');

    for (const episodeId of episodeIds) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Episode ID: ${episodeId}\n`);

      // Check all job states
      const states = ['active', 'waiting', 'delayed', 'failed', 'completed'] as const;

      for (const state of states) {
        const jobs = await dialogueQueue.getJobs([state]);
        const matchingJobs = jobs.filter(job => job.data.episodeId === episodeId);

        if (matchingJobs.length > 0) {
          console.log(`  ${state.toUpperCase()}: ${matchingJobs.length} job(s)`);
          for (const job of matchingJobs) {
            console.log(`    Job ID: ${job.id}`);
            console.log(`    Progress: ${job.progress}`);
            console.log(`    Attempts: ${job.attemptsMade}/${job.opts.attempts || 3}`);
            if (job.finishedOn) {
              console.log(`    Finished: ${new Date(job.finishedOn).toISOString()}`);
            }
            if (job.failedReason) {
              console.log(`    Failed Reason: ${job.failedReason}`);
            }
            console.log();
          }
        }
      }

      console.log();
    }

    // Get overall queue stats
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Queue Statistics:\n');

    const counts = await dialogueQueue.getJobCounts();
    console.log('  Active:', counts.active);
    console.log('  Waiting:', counts.waiting);
    console.log('  Delayed:', counts.delayed);
    console.log('  Failed:', counts.failed);
    console.log('  Completed:', counts.completed);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await dialogueQueue.close();
    await redis.quit();
  }
}

checkJobs();
