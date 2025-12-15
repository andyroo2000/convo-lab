import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://languageflow:Kx9mP2vNwQ7bL5tRj8dF3hYzW6cM4nXs@34.57.57.13:5432/languageflow?schema=public'
    }
  }
});

async function main() {
  const ep = await prisma.episode.findFirst({
    orderBy: { createdAt: 'desc' },
    include: { dialogue: { include: { speakers: true } } }
  });

  if (ep?.dialogue) {
    console.log('Speakers in latest episode:');
    ep.dialogue.speakers.forEach(s => {
      console.log(`  ${s.name}: ${s.voiceId}`);
      if (s.voiceId.includes('-')) {
        console.log(`    ✓ Will use Google TTS`);
      } else {
        console.log(`    ✗ Will use Polly (requires AWS credentials!)`);
      }
    });
  }

  await prisma.$disconnect();
}

main();
