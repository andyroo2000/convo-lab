import { Queue } from 'bullmq';
import { createRedisConnection } from '../src/config/redis.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  const episodeId = process.argv[2];

  if (!episodeId) {
    console.error('Usage: npx tsx trigger-episode-audio.ts <episode-id>');
    process.exit(1);
  }

  // Get episode details
  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: {
      dialogue: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!episode) {
    console.error(`Episode not found: ${episodeId}`);
    process.exit(1);
  }

  if (!episode.dialogue) {
    console.error(`Episode has no dialogue: ${episodeId}`);
    process.exit(1);
  }

  console.log(`\nTriggering audio generation for episode: ${episode.title}`);
  console.log(`  Episode ID: ${episode.id}`);
  console.log(`  Dialogue ID: ${episode.dialogue.id}`);

  const connection = createRedisConnection();
  const audioQueue = new Queue('audio-generation', { connection });

  const job = await audioQueue.add('generate-all-speeds', {
    episodeId: episode.id,
    dialogueId: episode.dialogue.id,
  }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  });

  console.log(`\n✅ Audio generation job queued: Job #${job.id}`);
  console.log(`\nMonitor progress in the UI at:`);
  console.log(`  https://convo-lab.com/app/playback/${episode.id}`);

  await audioQueue.close();
  await connection.quit();
  await prisma.$disconnect();
}

main().catch(console.error);
