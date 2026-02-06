/**
 * Migration script to update lesson scriptJson that has Journey voices to Neural2.
 * The voice IDs are baked into the scriptJson when lessons are generated.
 *
 * Run with: npx tsx scripts/migrate-lesson-scripts-to-neural2.ts
 */

import { prisma } from '../src/db/client.js';
import type { LessonScriptUnit } from '../src/services/lessonScriptGenerator.js';

async function migrateLessonScripts() {
  console.log('Finding lessons with Journey voices in scriptJson...');

  const lessons = await prisma.lesson.findMany({
    select: {
      id: true,
      title: true,
      scriptJson: true,
    },
  });

  // Map Journey voices to Neural2 equivalents
  const voiceMapping: Record<string, string> = {
    'en-US-Journey-D': 'en-US-Neural2-J',
    'en-US-Journey-F': 'en-US-Neural2-F',
  };

  let updatedCount = 0;

  for (const lesson of lessons) {
    const scriptJson = lesson.scriptJson as LessonScriptUnit[] | null;
    if (!scriptJson || !Array.isArray(scriptJson)) continue;

    let hasJourneyVoice = false;
    const updatedScript = scriptJson.map((unit) => {
      if (unit.voiceId && voiceMapping[unit.voiceId]) {
        hasJourneyVoice = true;
        return { ...unit, voiceId: voiceMapping[unit.voiceId] };
      }
      return unit;
    });

    if (hasJourneyVoice) {
      console.log(`  Updating lesson: ${lesson.title}`);
      await prisma.lesson.update({
        where: { id: lesson.id },
        data: { scriptJson: updatedScript },
      });
      updatedCount++;
    }
  }

  console.log(`\nMigrated ${updatedCount} lessons to Neural2 voices.`);
  await prisma.$disconnect();
}

migrateLessonScripts().catch(console.error);
