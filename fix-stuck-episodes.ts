import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find all episodes with error status that have dialogue with sentences
  const stuckEpisodes = await prisma.episode.findMany({
    where: {
      status: 'error',
      title: 'Generating dialogue...'
    },
    include: {
      dialogue: {
        include: {
          sentences: {
            take: 1,
            orderBy: {
              order: 'asc'
            }
          }
        }
      }
    }
  });

  console.log(`\nFound ${stuckEpisodes.length} stuck episodes\n`);

  for (const episode of stuckEpisodes) {
    if (episode.dialogue && episode.dialogue.sentences.length > 0) {
      // Extract a title from the source text or use first sentence
      const firstSentence = episode.dialogue.sentences[0];
      let newTitle = episode.sourceText.trim();

      // If source text is too long, truncate it
      if (newTitle.length > 100) {
        newTitle = newTitle.substring(0, 97) + '...';
      }

      console.log(`Fixing episode ${episode.id}:`);
      console.log(`  Current: "${episode.title}" (${episode.status})`);
      console.log(`  New: "${newTitle}" (ready)`);

      // Update episode to ready status with proper title
      await prisma.episode.update({
        where: { id: episode.id },
        data: {
          status: 'ready',
          title: newTitle
        }
      });

      console.log(`  ✅ Fixed\n`);
    } else {
      console.log(`Skipping episode ${episode.id} - no dialogue data\n`);
    }
  }

  console.log('Done!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
