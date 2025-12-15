import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function checkEpisode() {
  try {
    // Get the most recent episodes
    const episodes = await prisma.episode.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        targetLanguage: true,
      },
    });

    console.log('\nRecent episodes:');
    console.log(JSON.stringify(episodes, null, 2));

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkEpisode();
