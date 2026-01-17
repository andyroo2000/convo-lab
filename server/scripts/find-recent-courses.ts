#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  // Find courses created in the last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const courses = await prisma.course.findMany({
    where: {
      createdAt: {
        gte: oneHourAgo,
      },
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          emailVerified: true,
          role: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 10,
  });

  console.log(`\n=== ${courses.length} Courses Created in Last Hour ===\n`);

  for (const course of courses) {
    console.log('Course ID:', course.id);
    console.log('Title:', course.title);
    console.log('Status:', course.status);
    console.log('Created:', course.createdAt.toISOString());
    console.log('User:', course.user.email);
    console.log('Email Verified:', course.user.emailVerified);
    console.log('---');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
