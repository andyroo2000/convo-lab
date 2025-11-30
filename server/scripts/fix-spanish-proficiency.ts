import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixSpanishProficiency() {
  try {
    // Find all Spanish episodes
    const spanishEpisodes = await prisma.episode.findMany({
      where: { targetLanguage: 'es' },
      include: {
        dialogue: {
          include: {
            speakers: true,
          },
        },
      },
    });

    console.log(`Found ${spanishEpisodes.length} Spanish episodes`);

    for (const episode of spanishEpisodes) {
      if (!episode.dialogue) continue;

      for (const speaker of episode.dialogue.speakers) {
        // Convert any HSK levels to CEFR A1
        if (speaker.proficiency.startsWith('HSK')) {
          console.log(`Updating speaker ${speaker.name} from ${speaker.proficiency} to A1`);
          await prisma.speaker.update({
            where: { id: speaker.id },
            data: { proficiency: 'A1' },
          });
        }
      }
    }

    console.log('✅ Spanish dialogue proficiency levels updated successfully');
  } catch (error) {
    console.error('Failed to update proficiency levels:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixSpanishProficiency();
