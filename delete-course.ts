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
    console.error('Usage: tsx delete-course.ts <courseId>');
    process.exit(1);
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      title: true,
      userId: true,
    },
  });

  if (!course) {
    console.log(`Course not found: ${courseId}`);
    process.exit(1);
  }

  console.log(`\nDeleting course:`);
  console.log(`  ID: ${course.id}`);
  console.log(`  Title: ${course.title}`);
  console.log(`  User ID: ${course.userId}`);

  // Delete the course
  await prisma.course.delete({
    where: { id: courseId },
  });

  console.log(`\n✅ Course deleted successfully`);

  await prisma.$disconnect();
}

main().catch(console.error);
