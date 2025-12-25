import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://languageflow:Kx9mP2vNwQ7bL5tRj8dF3hYzW6cM4nXs@34.57.57.13:5432/languageflow?schema=public',
    },
  },
});

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

    // Find the latest episode
    const episode = await prisma.episode.findFirst({
      where: {
        targetLanguage: 'ja',
        status: 'ready',
      },
      orderBy: { createdAt: 'desc' },
      include: {
        dialogue: {
          include: {
            speakers: true,
          },
        },
      },
    });

    if (!episode) {
      console.log('No ready Japanese episodes found');
      return;
    }

    console.log(`📝 Episode: ${episode.title} (${episode.id})`);
    console.log(`   Status: ${episode.status}`);

    if (episode.dialogue) {
      console.log('\n🎤 Speakers:');
      episode.dialogue.speakers.forEach((s) => {
        console.log(`   ${s.name}: ${s.voiceId}`);
        if (s.voiceId.includes('-')) {
          console.log(`      ✓ Google TTS`);
        } else {
          console.log(`      ✓ AWS Polly`);
        }
      });
    }

    console.log('\n🎵 Triggering audio generation for all speeds...');

    // Queue audio generation jobs for all speeds
    const speeds = [0.7, 0.85, 1.0];
    for (const speed of speeds) {
      const job = await audioQueue.add('generate-audio', {
        episodeId: episode.id,
        speed,
      });
      console.log(`   Added job ${job.id} for speed ${speed}x`);
    }

    console.log('\n✅ Audio generation jobs queued!');
    console.log('\nMonitor progress:');
    console.log('  npx tsx check-audio-queue.ts');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
    await redis.quit();
  }
}

main();
