/**
 * Retry failed sample courses
 *
 * Resets courses in 'error' status back to 'draft' and queues them for regeneration.
 */

import { prisma } from '../src/db/client.js';
import { courseQueue } from '../src/jobs/courseQueue.js';

async function main() {
  console.log('🔍 Finding failed sample courses...\n');

  const failedCourses = await prisma.course.findMany({
    where: {
      title: 'Travel & Transportation',
      status: 'error',
    },
    select: {
      id: true,
      title: true,
      targetLanguage: true,
      jlptLevel: true,
      hskLevel: true,
      cefrLevel: true,
    },
  });

  console.log(`Found ${failedCourses.length} failed courses:\n`);

  if (failedCourses.length === 0) {
    console.log('✅ No failed courses found!');
    await prisma.$disconnect();
    return;
  }

  // Display what we found
  failedCourses.forEach((course, idx) => {
    const level = course.jlptLevel || course.hskLevel || course.cefrLevel || 'unknown';
    console.log(`${idx + 1}. ${course.targetLanguage} ${level}`);
  });

  console.log('\n🔧 Resetting and requeuing courses...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const course of failedCourses) {
    const level = course.jlptLevel || course.hskLevel || course.cefrLevel || 'unknown';

    try {
      // Reset course to draft
      await prisma.course.update({
        where: { id: course.id },
        data: {
          status: 'draft',
          audioUrl: null,
          scriptJson: null,
          approxDurationSeconds: null,
          timingData: null,
        },
      });

      // Delete existing core items (if any)
      await prisma.courseCoreItem.deleteMany({
        where: { courseId: course.id },
      });

      // Queue for regeneration
      const job = await courseQueue.add('generate-course', {
        courseId: course.id,
      });

      console.log(`✅ ${course.targetLanguage} ${level} - Reset and queued (Job #${job.id})`);
      successCount++;
    } catch (error: any) {
      console.log(`❌ ${course.targetLanguage} ${level} - Error: ${error.message}`);
      errorCount++;
    }

    // Small delay between courses
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('Summary:');
  console.log(`  Requeued: ${successCount}`);
  console.log(`  Errors: ${errorCount}`);
  console.log('='.repeat(60));

  if (successCount > 0) {
    console.log(`\n✅ ${successCount} courses have been reset and queued for regeneration.`);
    console.log('   Monitor worker logs to see generation progress.');
  }

  await prisma.$disconnect();
}

main();
