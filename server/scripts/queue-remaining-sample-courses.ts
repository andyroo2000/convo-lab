/**
 * Queue remaining draft sample courses
 *
 * Finds all "Travel & Transportation" courses that are in 'draft' status
 * and queues them for generation.
 */

import { prisma } from '../src/db/client.js';
import { courseQueue } from '../src/jobs/courseQueue.js';

async function main() {
  console.log('🔍 Finding draft sample courses...\n');

  const draftCourses = await prisma.course.findMany({
    where: {
      title: 'Travel & Transportation',
      status: 'draft',
    },
    select: {
      id: true,
      title: true,
      targetLanguage: true,
      jlptLevel: true,
    },
    orderBy: [
      { targetLanguage: 'asc' },
      { jlptLevel: 'asc' },
    ],
  });

  console.log(`Found ${draftCourses.length} draft courses:\n`);

  if (draftCourses.length === 0) {
    console.log('✅ No draft courses found! All courses are already queued or complete.');
    await prisma.$disconnect();
    return;
  }

  // Group by language for display
  const byLanguage = draftCourses.reduce(
    (acc, course) => {
      const lang = course.targetLanguage.toUpperCase();
      if (!acc[lang]) acc[lang] = [];
      acc[lang].push(course);
      return acc;
    },
    {} as Record<string, typeof draftCourses>
  );

  Object.entries(byLanguage).forEach(([lang, courses]) => {
    console.log(`${lang}:`);
    courses.forEach((course, idx) => {
      const level = course.jlptLevel || 'unknown';
      console.log(`  ${idx + 1}. ${level}`);
    });
    console.log('');
  });

  console.log('🔧 Queuing courses for generation...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const course of draftCourses) {
    const level = course.jlptLevel || 'unknown';
    const lang = course.targetLanguage.toUpperCase();

    try {
      // Queue for generation
      const job = await courseQueue.add('generate-course', {
        courseId: course.id,
      });

      console.log(`✅ ${lang} ${level} - Queued (Job #${job.id})`);
      successCount++;

      // Small delay to avoid overwhelming the queue
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.log(`❌ ${lang} ${level} - Error: ${errorMsg}`);
      errorCount++;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('Summary:');
  console.log(`  Total draft courses: ${draftCourses.length}`);
  console.log(`  Successfully queued: ${successCount}`);
  console.log(`  Errors: ${errorCount}`);
  console.log('='.repeat(60));

  if (successCount > 0) {
    console.log(`\n✅ ${successCount} courses have been queued for generation.`);
    console.log('   Worker will process them sequentially.');
    console.log('   Each course takes approximately 2-5 minutes to generate.');
    console.log(`   Estimated total time: ${Math.round((successCount * 3.5) / 60)} hours`);
  }

  await prisma.$disconnect();
}

main();
