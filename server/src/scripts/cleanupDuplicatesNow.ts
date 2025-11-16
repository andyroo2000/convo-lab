#!/usr/bin/env node
import { prisma } from '../db/client.js';

async function cleanup() {
  // Delete the stuck lesson (18:50, no audio)
  await prisma.lessonCoreItem.deleteMany({
    where: { lessonId: '64f7f959-b7e9-47f2-8afd-b850c3158031' },
  });

  await prisma.lesson.delete({
    where: { id: '64f7f959-b7e9-47f2-8afd-b850c3158031' },
  });

  console.log('✅ Deleted stuck lesson');

  await prisma.$disconnect();
  process.exit(0);
}

cleanup();
