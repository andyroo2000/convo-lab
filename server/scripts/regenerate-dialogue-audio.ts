#!/usr/bin/env npx tsx

import { QueueEvents } from 'bullmq';
import { audioQueue } from '../src/jobs/audioQueue.js';
import { createRedisConnection } from '../src/config/redis.js';
import { prisma } from '../src/db/client.js';

const episodeId = process.argv[2];
const dialogueId = process.argv[3];

if (!episodeId || !dialogueId) {
  console.error('Usage: npx tsx scripts/regenerate-dialogue-audio.ts <episodeId> <dialogueId>');
  process.exit(1);
}

async function regenerateDialogueAudio() {
  const connection = createRedisConnection();
  const queueEvents = new QueueEvents('audio-generation', { connection });

  try {
    console.log(`\n🎵 Regenerating audio for dialogue ${dialogueId} (episode ${episodeId})...`);
    console.log(`Using Fish Audio S1 model (flagship quality)\n`);

    // Add job to queue
    const job = await audioQueue.add('generate-all-speeds', {
      episodeId,
      dialogueId,
    });

    console.log(`✅ Job ${job.id} added to queue`);
    console.log(`\nWaiting for completion...`);

    // Wait for job to complete
    const result = await job.waitUntilFinished(queueEvents);

    console.log(`\n🎉 Audio generation complete!`);
    console.log(`Results:`, JSON.stringify(result, null, 2));

    await queueEvents.close();
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error regenerating audio:', error);
    await queueEvents.close();
    await prisma.$disconnect();
    process.exit(1);
  }
}

regenerateDialogueAudio();
