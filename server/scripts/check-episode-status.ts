import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  const episodeId = process.argv[2];

  if (!episodeId) {
    console.error('Usage: npx tsx check-episode-status.ts <episode-id>');
    process.exit(1);
  }

  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: {
      dialogue: {
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!episode) {
    console.log(`Episode not found: ${episodeId}`);
    process.exit(1);
  }

  console.log('\nEpisode Details:');
  console.log(`  ID: ${episode.id}`);
  console.log(`  Title: ${episode.title}`);
  console.log(`  Status: ${episode.status}`);
  console.log(`  Has dialogue: ${episode.dialogue ? 'Yes' : 'No'}`);
  if (episode.dialogue) {
    console.log(`  Dialogue ID: ${episode.dialogue.id}`);
  }
  console.log(`  Audio URL: ${episode.audioUrl ? 'Yes' : 'No'}`);
  console.log(`  Created: ${episode.createdAt}`);
  console.log(`  Updated: ${episode.updatedAt}`);

  if (episode.dialogue) {
    const sentences = await prisma.sentence.findMany({
      where: { dialogueId: episode.dialogue.id },
      select: {
        id: true,
        order: true,
        text: true,
        audioUrl: true,
      },
      orderBy: { order: 'asc' },
      take: 5,
    });

    const totalSentences = await prisma.sentence.count({
      where: { dialogueId: episode.dialogue.id },
    });

    const withAudio = await prisma.sentence.count({
      where: {
        dialogueId: episode.dialogue.id,
        audioUrl: { not: null },
      },
    });

    console.log(`\nSentence Audio Status:`);
    console.log(`  Total sentences: ${totalSentences}`);
    console.log(`  With audio: ${withAudio}`);
    console.log(`  Missing audio: ${totalSentences - withAudio}`);

    if (sentences.length > 0) {
      console.log(`\nFirst 5 sentences:`);
      for (const s of sentences) {
        const preview = s.text.length > 50 ? s.text.substring(0, 50) + '...' : s.text;
        console.log(`  ${s.order}. ${preview}`);
        console.log(`     Audio: ${s.audioUrl ? 'Yes' : 'NO'}`);
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
