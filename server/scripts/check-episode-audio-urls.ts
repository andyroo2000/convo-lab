import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  const episodeId = process.argv[2];

  if (!episodeId) {
    console.error('Usage: npx tsx check-episode-audio-urls.ts <episode-id>');
    process.exit(1);
  }

  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    select: {
      id: true,
      title: true,
      audioUrl: true,
      audioUrl_0_7: true,
      audioUrl_0_85: true,
      audioUrl_1_0: true,
    },
  });

  if (!episode) {
    console.log(`Episode not found: ${episodeId}`);
    process.exit(1);
  }

  console.log('\nEpisode Audio URLs:');
  console.log(`  Title: ${episode.title}`);
  console.log(`  audioUrl: ${episode.audioUrl || 'NULL'}`);
  console.log(`  audioUrl_0_7: ${episode.audioUrl_0_7 || 'NULL'}`);
  console.log(`  audioUrl_0_85: ${episode.audioUrl_0_85 || 'NULL'}`);
  console.log(`  audioUrl_1_0: ${episode.audioUrl_1_0 || 'NULL'}`);

  await prisma.$disconnect();
}

main().catch(console.error);
