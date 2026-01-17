#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
  log: ['query'],
});

async function main() {
  console.log('\n=== Database Connection Info ===');
  console.log('DATABASE_URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'));

  // Get total counts
  const userCount = await prisma.user.count();
  const courseCount = await prisma.course.count();
  const dialogueCount = await prisma.dialogue.count();

  console.log('\n=== Database Statistics ===');
  console.log('Total Users:', userCount);
  console.log('Total Courses:', courseCount);
  console.log('Total Dialogues:', dialogueCount);

  // Get most recent courses (last 24 hours or last 10)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const recentCourses = await prisma.course.findMany({
    where: {
      createdAt: {
        gte: oneDayAgo,
      },
    },
    include: {
      user: {
        select: {
          email: true,
          emailVerified: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 10,
  });

  console.log(`\n=== ${recentCourses.length} Courses Created in Last 24 Hours ===\n`);

  for (const course of recentCourses) {
    console.log(`${course.createdAt.toISOString()} - ${course.title} (${course.user.email}) - Verified: ${course.user.emailVerified}`);
  }

  // If no recent courses, show last 10 courses
  if (recentCourses.length === 0) {
    const lastCourses = await prisma.course.findMany({
      include: {
        user: {
          select: {
            email: true,
            emailVerified: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    });

    console.log(`\n=== Last 10 Courses (Any Time) ===\n`);
    for (const course of lastCourses) {
      console.log(`${course.createdAt.toISOString()} - ${course.title} (${course.user.email}) - Verified: ${course.user.emailVerified}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
