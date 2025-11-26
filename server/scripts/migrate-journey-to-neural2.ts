/**
 * Migration script to update courses using Journey voices to Neural2 voices.
 * Journey voices don't support enableTimePointing in v1beta1 API.
 *
 * Run with: npx tsx scripts/migrate-journey-to-neural2.ts
 */

import { prisma } from '../src/db/client.js';

async function migrateJourneyVoices() {
  console.log('Finding courses with Journey voices...');

  const coursesWithJourney = await prisma.course.findMany({
    where: {
      l1VoiceId: {
        contains: 'Journey',
      },
    },
    select: {
      id: true,
      title: true,
      l1VoiceId: true,
    },
  });

  console.log(`Found ${coursesWithJourney.length} courses with Journey voices`);

  if (coursesWithJourney.length === 0) {
    console.log('No migration needed.');
    await prisma.$disconnect();
    return;
  }

  // Map Journey voices to Neural2 equivalents
  const voiceMapping: Record<string, string> = {
    'en-US-Journey-D': 'en-US-Neural2-J', // Male Journey -> Male Neural2
    'en-US-Journey-F': 'en-US-Neural2-F', // Female Journey -> Female Neural2
  };

  for (const course of coursesWithJourney) {
    const newVoice = voiceMapping[course.l1VoiceId] || 'en-US-Neural2-J';
    console.log(`  ${course.title}: ${course.l1VoiceId} -> ${newVoice}`);

    await prisma.course.update({
      where: { id: course.id },
      data: { l1VoiceId: newVoice },
    });
  }

  console.log(`\nMigrated ${coursesWithJourney.length} courses to Neural2 voices.`);
  await prisma.$disconnect();
}

migrateJourneyVoices().catch(console.error);
