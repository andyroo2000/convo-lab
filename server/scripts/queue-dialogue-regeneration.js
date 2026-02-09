#!/usr/bin/env node

/**
 * Queue a dialogue audio regeneration job
 *
 * Usage: node scripts/queue-dialogue-regeneration.js <episodeId> <dialogueId>
 *
 * This script adds a job to the audio queue to regenerate all 3 speeds
 * (slow, medium, normal) for a dialogue. The worker will pick it up automatically.
 */

const { audioQueue } = require('../dist/server/src/jobs/audioQueue.js');

const episodeId = process.argv[2];
const dialogueId = process.argv[3];

if (!episodeId || !dialogueId) {
  console.error('❌ Missing required arguments');
  console.error('Usage: node scripts/queue-dialogue-regeneration.js <episodeId> <dialogueId>');
  process.exit(1);
}

(async () => {
  try {
    console.log('📋 Adding dialogue regeneration job to queue...');
    console.log(`   Episode ID: ${episodeId}`);
    console.log(`   Dialogue ID: ${dialogueId}`);

    const job = await audioQueue.add('generate-all-speeds', {
      episodeId,
      dialogueId
    });

    console.log(`\n✅ Job added successfully!`);
    console.log(`   Job ID: ${job.id}`);
    console.log(`   The worker will process this job automatically`);
    console.log(`   Check worker logs to monitor progress: docker logs -f convolab-worker`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding job:', error.message);
    process.exit(1);
  }
})();
