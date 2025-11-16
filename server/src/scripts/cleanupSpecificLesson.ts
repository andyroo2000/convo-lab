#!/usr/bin/env node
import { prisma } from '../db/client.js';

async function cleanup() {
  const lessonId = '49710531-6762-4073-896d-a87ef6d7f917';
  const courseId = '3e0dc9bb-90e8-4507-84a1-17a15752fb2e';

  // Delete lesson core items
  await prisma.lessonCoreItem.deleteMany({
    where: { lessonId },
  });

  // Delete lesson
  await prisma.lesson.delete({
    where: { id: lessonId },
  });

  // Reset course to draft
  await prisma.course.update({
    where: { id: courseId },
    data: { status: 'draft' },
  });

  console.log('✅ Cleaned up stuck lesson and reset course to draft');

  await prisma.$disconnect();
  process.exit(0);
}

cleanup();
