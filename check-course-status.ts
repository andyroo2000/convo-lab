#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://languageflow:Kx9mP2vNwQ7bL5tRj8dF3hYzW6cM4nXs@34.57.57.13:5432/languageflow?schema=public',
    },
  },
});

async function main() {
  const courseId = process.argv[2];

  if (!courseId) {
    console.error('Usage: tsx check-course-status.ts <courseId>');
    process.exit(1);
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      title: true,
      status: true,
      audioUrl: true,
      updatedAt: true,
    },
  });

  if (!course) {
    console.error(`Course not found: ${courseId}`);
    process.exit(1);
  }

  console.log(`\n📝 Course: ${course.title} (${course.id})`);
  console.log(`   Status: ${course.status}`);
  console.log(`   Audio URL: ${course.audioUrl || '(none)'}`);
  console.log(`   Last Updated: ${course.updatedAt.toISOString()}`);

  await prisma.$disconnect();
}

main().catch(console.error);
