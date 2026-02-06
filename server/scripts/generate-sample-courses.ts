/**
 * Script to generate sample audio courses for Japanese JLPT levels
 *
 * Creates 1 Pimsleur-style audio course per language/level combination from the 3 sample dialogues
 *
 * Levels:
 * - Japanese: N5, N4, N3, N2, N1 (5 courses)
 *
 * Usage: npx tsx scripts/generate-sample-courses.ts [level]
 * Examples:
 *   npx tsx scripts/generate-sample-courses.ts          # Generate all
 *   npx tsx scripts/generate-sample-courses.ts N5       # Just Japanese N5
 */

import { prisma } from '../src/db/client.js';
import { courseQueue } from '../src/jobs/courseQueue.js';
import { DEFAULT_NARRATOR_VOICES } from '@languageflow/shared/src/constants-new.js';

type LanguageCode = 'ja';

// Language-specific level configurations
const LANGUAGE_LEVELS: Record<LanguageCode, string[]> = {
  ja: ['N5', 'N4', 'N3', 'N2', 'N1'],
};

const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  ja: 'Japanese',
};

const COURSE_TITLE = 'Travel & Transportation';
const COURSE_DESCRIPTION_TEMPLATE = (language: string, level: string) =>
  `Learn essential ${language} phrases for travel and getting around. This Pimsleur-style audio course teaches you how to navigate public transit, ask for directions, and communicate in transportation situations at the ${level} level.`;

/**
 * Find or create the system user for owning sample content
 */
async function findOrCreateSystemUser() {
  let systemUser = await prisma.user.findFirst({
    where: { email: 'system@languageflow.app' },
  });

  if (!systemUser) {
    systemUser = await prisma.user.create({
      data: {
        email: 'system@languageflow.app',
        name: 'System',
        role: 'admin',
        emailVerified: true,
        onboardingCompleted: true,
      },
    });
    console.log(`✓ Created system user: ${systemUser.id}`);
  }

  return systemUser;
}

async function generateSampleCourse(
  systemUserId: string,
  language: LanguageCode,
  level: string
) {
  const fullTitle = `${COURSE_TITLE} (${LANGUAGE_NAMES[language]} ${level})`;
  console.log(`\n📚 Creating course: "${fullTitle}"...`);

  // Check if this course already exists
  const existing = await prisma.course.findFirst({
    where: {
      title: COURSE_TITLE,
      targetLanguage: language,
      isSampleContent: true,
      jlptLevel: level,
    },
  });

  if (existing) {
    console.log(`  ⏭️  Course already exists (${existing.status}), skipping`);
    return existing.id;
  }

  // Find the 3 sample dialogues for this language/level
  // Proficiency level is stored in Speaker records
  const sampleEpisodes = await prisma.episode.findMany({
    where: {
      isSampleContent: true,
      targetLanguage: language,
      dialogue: {
        speakers: {
          some: {
            proficiency: level,
          },
        },
      },
    },
    include: {
      dialogue: {
        include: {
          speakers: true,
        },
      },
    },
    take: 3, // We want 3 dialogues per course
  });

  if (sampleEpisodes.length === 0) {
    console.log(`  ❌ No sample dialogues found for ${language} ${level}`);
    return null;
  }

  if (sampleEpisodes.length < 3) {
    console.log(
      `  ⚠️  Only found ${sampleEpisodes.length} dialogues (expected 3) for ${language} ${level}`
    );
  }

  console.log(`  ✓ Found ${sampleEpisodes.length} sample dialogues`);
  sampleEpisodes.forEach((ep, idx) => {
    console.log(`    ${idx + 1}. ${ep.title}`);
  });

  // Get narrator voice for native language (always English for now)
  const nativeLanguage = 'en';
  const narratorVoice = DEFAULT_NARRATOR_VOICES[nativeLanguage as keyof typeof DEFAULT_NARRATOR_VOICES];

  if (!narratorVoice) {
    throw new Error(`No default narrator voice found for language: ${nativeLanguage}`);
  }

  // Get speaker genders from first dialogue
  const speakers = sampleEpisodes[0].dialogue?.speakers || [];
  const speaker1Gender = (speakers[0]?.gender as 'male' | 'female') || 'male';
  const speaker2Gender = (speakers[1]?.gender as 'male' | 'female') || 'female';

  // Create course
  const course = await prisma.course.create({
    data: {
      userId: systemUserId,
      title: COURSE_TITLE,
      description: COURSE_DESCRIPTION_TEMPLATE(LANGUAGE_NAMES[language], level),
      status: 'draft',
      isSampleContent: true,
      nativeLanguage,
      targetLanguage: language,
      maxLessonDurationMinutes: 15,
      l1VoiceId: narratorVoice,
      jlptLevel: level,
      speaker1Gender,
      speaker2Gender,
    },
  });

  console.log(`  ✓ Created course: ${course.id}`);

  // Link episodes to course
  await Promise.all(
    sampleEpisodes.map((episode, index) =>
      prisma.courseEpisode.create({
        data: {
          courseId: course.id,
          episodeId: episode.id,
          order: index,
        },
      })
    )
  );

  console.log(`  ✓ Linked ${sampleEpisodes.length} episodes to course`);

  // Queue course generation job
  console.log(`  ⏳ Queueing course generation job...`);
  const job = await courseQueue.add('generate-course', {
    courseId: course.id,
  });

  console.log(`  ✅ Job queued: ${job.id}`);
  console.log(`      Course will be generated asynchronously`);

  return course.id;
}

async function main() {
  const args = process.argv.slice(2);
  const targetLevel = args[0];

  console.log('🚀 Starting sample course generation...\n');

  try {
    const systemUser = await findOrCreateSystemUser();

    const languages = Object.keys(LANGUAGE_LEVELS) as LanguageCode[];
    let totalGenerated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const lang of languages) {
      const levels = targetLevel ? [targetLevel] : LANGUAGE_LEVELS[lang];

      console.log(`\n${'='.repeat(60)}`);
      console.log(`📖 ${LANGUAGE_NAMES[lang]} Courses (${levels.length} levels)`);
      console.log('='.repeat(60));

      for (const level of levels) {
        try {
          const result = await generateSampleCourse(systemUser.id, lang, level);

          if (result === null) {
            totalErrors++;
          } else {
            const existing = await prisma.course.findUnique({
              where: { id: result },
              select: { status: true },
            });

            if (existing?.status === 'draft') {
              totalGenerated++;
            } else {
              totalSkipped++;
            }
          }

          // Add a small delay between course creations to avoid overwhelming the system
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`  ❌ Error creating course for ${lang} ${level}:`, error);
          totalErrors++;
        }
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('✅ Sample Course Generation Complete');
    console.log('='.repeat(60));
    console.log(`New courses queued: ${totalGenerated}`);
    console.log(`Already existed: ${totalSkipped}`);
    console.log(`Errors: ${totalErrors}`);
    console.log(`\nℹ️  Courses are being generated asynchronously by worker jobs.`);
    console.log(`   Check course status to see generation progress.`);
    console.log(`   Generation typically takes 2-5 minutes per course.`);

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Fatal error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
