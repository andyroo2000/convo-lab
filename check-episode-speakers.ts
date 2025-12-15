import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://languageflow:Kx9mP2vNwQ7bL5tRj8dF3hYzW6cM4nXs@34.57.57.13:5432/languageflow?schema=public'
    }
  }
});

async function main() {
  try {
    const episode = await prisma.episode.findFirst({
      orderBy: { createdAt: 'desc' },
      include: {
        dialogue: {
          include: {
            speakers: true
          }
        }
      }
    });

    if (episode?.dialogue) {
      console.log(`\nEpisode: ${episode.title}`);
      console.log(`\nSpeakers:`);
      episode.dialogue.speakers.forEach(s => {
        console.log(`\n  Name: ${s.name}`);
        console.log(`  Gender: ${s.gender}`);
        console.log(`  Voice ID: ${s.voiceId}`);
        console.log(`  Avatar: ${s.avatarUrl || 'none'}`);
      });
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
