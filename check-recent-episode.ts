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
    // Get the most recent episode
    const latestEpisode = await prisma.episode.findFirst({
      orderBy: { createdAt: 'desc' },
      include: {
        dialogue: {
          include: {
            sentences: {
              take: 2,
              orderBy: { order: 'asc' }
            }
          }
        }
      }
    });

    if (latestEpisode) {
      console.log(`\nMost recent episode: ${latestEpisode.id}`);
      console.log(`  Title: ${latestEpisode.title}`);
      console.log(`  Status: ${latestEpisode.status}`);
      console.log(`  Language: ${latestEpisode.targetLanguage}`);
      console.log(`  Created: ${latestEpisode.createdAt}`);
      console.log(`  Audio URLs:`);
      console.log(`    0.7x: ${latestEpisode.audioUrl_0_7 || 'null'}`);
      console.log(`    0.85x: ${latestEpisode.audioUrl_0_85 || 'null'}`);
      console.log(`    1.0x: ${latestEpisode.audioUrl_1_0 || 'null'}`);

      if (latestEpisode.dialogue) {
        console.log(`\n  Dialogue ID: ${latestEpisode.dialogue.id}`);
        console.log(`  Sentences: ${latestEpisode.dialogue.sentences.length > 0 ? 'Present' : 'None'}`);

        if (latestEpisode.dialogue.sentences.length > 0) {
          console.log(`\n  First sentence: ${latestEpisode.dialogue.sentences[0].text}`);
          const metadata = latestEpisode.dialogue.sentences[0].metadata as any;
          if (metadata?.japanese?.furigana) {
            console.log(`  Furigana: ${metadata.japanese.furigana}`);
          }
        }
      }
    } else {
      console.log('No episodes found');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
