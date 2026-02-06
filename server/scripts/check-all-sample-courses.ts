/**
 * Check status of all sample courses
 */

import { prisma } from '../src/db/client.js';

async function main() {
  console.log('📊 Sample Course Status Report\n');
  console.log('='.repeat(60));

  const courses = await prisma.course.findMany({
    where: {
      title: 'Travel & Transportation',
    },
    select: {
      id: true,
      targetLanguage: true,
      jlptLevel: true,
      status: true,
      audioUrl: true,
      approxDurationSeconds: true,
    },
    orderBy: [
      { targetLanguage: 'asc' },
      { jlptLevel: 'asc' },
    ],
  });

  console.log(`Total courses: ${courses.length}\n`);

  // Group by status
  const byStatus = courses.reduce(
    (acc, course) => {
      acc[course.status] = (acc[course.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log('Status breakdown:');
  Object.entries(byStatus)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([status, count]) => {
      console.log(`  ${status.padEnd(12)}: ${count}`);
    });

  console.log('\n' + '='.repeat(60));
  console.log('Courses by language:\n');

  // Group by language
  const byLanguage = courses.reduce(
    (acc, course) => {
      if (!acc[course.targetLanguage]) {
        acc[course.targetLanguage] = [];
      }
      acc[course.targetLanguage].push(course);
      return acc;
    },
    {} as Record<string, typeof courses>
  );

  Object.entries(byLanguage)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([lang, langCourses]) => {
      console.log(`${lang.toUpperCase()}:`);
      langCourses.forEach((course) => {
        const level = course.jlptLevel || '?';
        const duration = course.approxDurationSeconds
          ? `${Math.round(course.approxDurationSeconds / 60)}m`
          : '-';
        const statusSymbol =
          course.status === 'ready'
            ? '✅'
            : course.status === 'generating'
              ? '⏳'
              : course.status === 'error'
                ? '❌'
                : '⏸️';
        console.log(`  ${statusSymbol} ${level.padEnd(4)} - ${course.status.padEnd(12)} ${duration.padStart(5)}`);
      });
      console.log('');
    });

  console.log('='.repeat(60));

  await prisma.$disconnect();
}

main();
