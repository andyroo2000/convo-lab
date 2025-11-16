#!/usr/bin/env node
import { prisma } from '../db/client.js';

async function fixStuckLesson() {
  // The stuck lesson
  const lessonId = '1c00dc59-ea19-46a5-a5f4-62597e607016';

  console.log('Fixing stuck lesson...\n');

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { course: true },
  });

  if (!lesson) {
    console.log('Lesson not found.');
    await prisma.$disconnect();
    process.exit(0);
    return;
  }

  console.log(`Lesson: ${lesson.title}`);
  console.log(`Current status: ${lesson.status}`);
  console.log(`Has audio: ${!!lesson.audioUrl}`);

  if (lesson.status === 'generating' && !lesson.audioUrl) {
    console.log('\nLesson is stuck in "generating" with no audio.');
    console.log('Deleting this broken lesson...\n');

    // Delete core items first
    await prisma.lessonCoreItem.deleteMany({
      where: { lessonId: lesson.id },
    });

    // Delete the lesson
    await prisma.lesson.delete({
      where: { id: lesson.id },
    });

    // Update course status to draft so user can regenerate
    await prisma.course.update({
      where: { id: lesson.courseId },
      data: { status: 'draft' },
    });

    console.log('✅ Deleted broken lesson and reset course to "draft" status.');
    console.log('User can now regenerate the course.');
  } else {
    console.log('Lesson is not stuck, no action needed.');
  }

  await prisma.$disconnect();
  process.exit(0);
}

fixStuckLesson();
