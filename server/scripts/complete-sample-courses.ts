/**
 * Complete generation of all sample audio courses
 *
 * This script is designed to run in the background and complete the generation
 * of all remaining sample courses without running out of context.
 *
 * Features:
 * - Checks which courses are missing or failed
 * - Retries failed courses
 * - Handles errors gracefully
 * - Logs progress to a file
 * - Can resume where it left off
 *
 * Usage: DATABASE_URL="..." npx tsx server/scripts/complete-sample-courses.ts
 */

import { prisma } from '../src/db/client.js';
import { courseQueue } from '../src/jobs/courseQueue.js';
import { DEFAULT_NARRATOR_VOICES } from '@languageflow/shared/src/constants-new.js';
import * as fs from 'fs';
import * as path from 'path';

type LanguageCode = 'ja';

// Language-specific level configurations
const LANGUAGE_LEVELS: Record<LanguageCode, string[]> = {
  ja: ['N5', 'N4', 'N3', 'N2', 'N1'],
};

const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  ja: 'Japanese',
};

const COURSE_TITLE = 'Travel & Transportation';

const LOG_FILE = path.join(process.cwd(), 'sample-courses-progress.log');

function log(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(message);
  fs.appendFileSync(LOG_FILE, logMessage);
}

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
    log(`✓ Created system user: ${systemUser.id}`);
  }

  return systemUser;
}

/**
 * Check if a course exists for this language/level combination
 */
async function findExistingCourse(language: LanguageCode, level: string) {
  const course = await prisma.course.findFirst({
    where: {
      title: COURSE_TITLE,
      targetLanguage: language,
      jlptLevel: level,
    },
    include: {
      _count: {
        select: {
          coreItems: true,
        },
      },
    },
  });

  return course;
}

/**
 * Check if we should generate this course
 */
function shouldGenerateCourse(course: Awaited<ReturnType<typeof findExistingCourse>>): { shouldGenerate: boolean; reason: string } {
  if (!course) {
    return { shouldGenerate: true, reason: 'Course does not exist' };
  }

  if (course.status === 'ready' && course.audioUrl) {
    return { shouldGenerate: false, reason: 'Course already complete' };
  }

  if (course.status === 'generating') {
    return { shouldGenerate: false, reason: 'Course is currently generating' };
  }

  if (course.status === 'error') {
    return { shouldGenerate: true, reason: 'Retrying failed course' };
  }

  if (course.status === 'draft' && !course.audioUrl) {
    return { shouldGenerate: true, reason: 'Course draft needs generation' };
  }

  return { shouldGenerate: false, reason: `Unknown status: ${course.status}` };
}

/**
 * Reset a course to draft status so it can be regenerated
 */
async function resetCourse(courseId: string) {
  await prisma.course.update({
    where: { id: courseId },
    data: {
      status: 'draft',
      audioUrl: null,
      scriptJson: null,
      approxDurationSeconds: null,
      timingData: null,
    },
  });

  // Delete existing core items
  await prisma.courseCoreItem.deleteMany({
    where: { courseId },
  });

  log(`✓ Reset course to draft status`);
}

/**
 * Generate or regenerate a sample course
 */
async function generateSampleCourse(
  systemUserId: string,
  language: LanguageCode,
  level: string
) {
  const fullTitle = `${COURSE_TITLE} (${LANGUAGE_NAMES[language]} ${level})`;
  log(`\n📚 Processing: "${fullTitle}"...`);

  // Check if course exists
  const existing = await findExistingCourse(language, level);
  const shouldGen = shouldGenerateCourse(existing);

  if (!shouldGen.shouldGenerate) {
    log(`  ⏭️  Skipping: ${shouldGen.reason}`);
    return { status: 'skipped', reason: shouldGen.reason };
  }

  log(`  → Action: ${shouldGen.reason}`);

  let courseId: string;

  if (existing) {
    // Reset existing course
    courseId = existing.id;
    await resetCourse(courseId);
  } else {
    // Create new course
    log(`  → Creating new course...`);

    // Find the 3 sample dialogues for this language/level
    const sampleEpisodes = await prisma.episode.findMany({
      where: {
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
      take: 3,
    });

    if (sampleEpisodes.length === 0) {
      log(`  ❌ No sample dialogues found for ${language} ${level}`);
      return { status: 'error', reason: 'No dialogues found' };
    }

    if (sampleEpisodes.length < 3) {
      log(
        `  ⚠️  Only found ${sampleEpisodes.length} dialogues (expected 3) for ${language} ${level}`
      );
    }

    log(`  ✓ Found ${sampleEpisodes.length} sample dialogues`);

    // Get narrator voice
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
        description: `Learn essential ${LANGUAGE_NAMES[language]} phrases for travel and getting around. This Pimsleur-style audio course teaches you how to navigate public transit, ask for directions, and communicate in transportation situations at the ${level} level.`,
        status: 'draft',
        nativeLanguage,
        targetLanguage: language,
        maxLessonDurationMinutes: 15,
        l1VoiceId: narratorVoice,
        jlptLevel: level,
        speaker1Gender,
        speaker2Gender,
      },
    });

    courseId = course.id;
    log(`  ✓ Created course: ${courseId}`);

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

    log(`  ✓ Linked ${sampleEpisodes.length} episodes to course`);
  }

  // Queue course generation job
  log(`  ⏳ Queueing course generation job...`);
  try {
    const job = await courseQueue.add('generate-course', {
      courseId,
    });

    log(`  ✅ Job queued: ${job.id}`);
    return { status: 'queued', courseId, jobId: job.id };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log(`  ❌ Error queuing job: ${message}`);
    return { status: 'error', reason: message };
  }
}

async function main() {
  log('🚀 Starting complete sample course generation...');
  log(`📝 Logging progress to: ${LOG_FILE}`);
  log('');

  try {
    const systemUser = await findOrCreateSystemUser();

    const stats = {
      total: 0,
      queued: 0,
      skipped: 0,
      errors: 0,
      details: [] as Array<{
        language: LanguageCode;
        level: string;
        status: string;
        reason?: string;
        courseId?: string;
        jobId?: string | number;
      }>,
    };

    // Process all language/level combinations
    for (const language of Object.keys(LANGUAGE_LEVELS) as LanguageCode[]) {
      const levels = LANGUAGE_LEVELS[language];

      log(`\n${'='.repeat(60)}`);
      log(`📖 ${LANGUAGE_NAMES[language]} Courses (${levels.length} levels)`);
      log('='.repeat(60));

      for (const level of levels) {
        stats.total++;

        try {
          const result = await generateSampleCourse(systemUser.id, language, level);

          if (result.status === 'queued') {
            stats.queued++;
          } else if (result.status === 'skipped') {
            stats.skipped++;
          } else if (result.status === 'error') {
            stats.errors++;
          }

          stats.details.push({
            language,
            level,
            ...result,
          });

          // Small delay to avoid overwhelming the system
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          log(`  ❌ Error processing ${language} ${level}: ${message}`);
          stats.errors++;
          stats.details.push({
            language,
            level,
            status: 'error',
            reason: message,
          });
        }
      }
    }

    // Final summary
    log(`\n${'='.repeat(60)}`);
    log('✅ Complete Sample Course Generation Finished');
    log('='.repeat(60));
    log(`Total combinations processed: ${stats.total}`);
    log(`New courses queued: ${stats.queued}`);
    log(`Already complete/generating: ${stats.skipped}`);
    log(`Errors: ${stats.errors}`);

    if (stats.queued > 0) {
      log(`\nℹ️  ${stats.queued} courses are now being generated asynchronously.`);
      log(`   Each course typically takes 2-5 minutes to generate.`);
      log(`   Monitor worker logs to see generation progress.`);
    }

    // Write detailed results to JSON
    const resultsFile = path.join(process.cwd(), 'sample-courses-results.json');
    fs.writeFileSync(resultsFile, JSON.stringify(stats, null, 2));
    log(`\n📊 Detailed results written to: ${resultsFile}`);

    await prisma.$disconnect();
    process.exit(0);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : '';
    log(`❌ Fatal error: ${message}`);
    if (stack) {
      log(stack);
    }
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
