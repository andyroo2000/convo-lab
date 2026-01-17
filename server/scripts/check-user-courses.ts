#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  const userId = process.argv[2];

  if (!userId) {
    console.error('Usage: npx tsx scripts/check-user-courses.ts <user-id>');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      emailVerified: true,
    },
  });

  if (!user) {
    console.error(`User not found: ${userId}`);
    process.exit(1);
  }

  console.log('\n=== User Details ===');
  console.log('Name:', user.name);
  console.log('Email:', user.email);
  console.log('Email Verified:', user.emailVerified);

  const courses = await prisma.course.findMany({
    where: { userId },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      targetLanguage: true,
      nativeLanguage: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  console.log(`\n=== ${courses.length} Courses ===\n`);

  for (const course of courses) {
    console.log('Course ID:', course.id);
    console.log('Title:', course.title);
    console.log('Status:', course.status);
    console.log('Languages:', `${course.targetLanguage} → ${course.nativeLanguage}`);
    console.log('Created:', course.createdAt.toISOString());
    console.log('---');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
