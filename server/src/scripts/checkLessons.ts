#!/usr/bin/env node
import { prisma } from '../db/client.js';

async function checkLessons() {
  const courses = await prisma.course.findMany({
    include: {
      lessons: {
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  for (const course of courses) {
    console.log(`\nCourse: ${course.title} (${course.id})`);
    console.log(`Status: ${course.status}`);
    console.log(`Lessons (${course.lessons.length}):`);

    for (const lesson of course.lessons) {
      const minutes = Math.floor(lesson.approxDurationSeconds / 60);
      const seconds = lesson.approxDurationSeconds % 60;
      console.log(`  - ${lesson.title} (order ${lesson.order})`);
      console.log(`    ID: ${lesson.id}`);
      console.log(`    Status: ${lesson.status}`);
      console.log(`    Duration: ${minutes}:${seconds.toString().padStart(2, '0')}`);
      console.log(`    Audio URL: ${lesson.audioUrl ? 'Yes' : 'No'}`);
    }
  }

  await prisma.$disconnect();
  process.exit(0);
}

checkLessons();
