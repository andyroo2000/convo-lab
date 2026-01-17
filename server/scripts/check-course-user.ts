#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  const courseId = '2ba62702-eb62-4a2c-bc56-80ca5a38b4d0';

  const course = await prisma.course.findUnique({
    where: { id: courseId },
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
  });

  if (!course) {
    console.log('Course not found');
    process.exit(1);
  }

  console.log('\n=== Course Details ===');
  console.log('Course ID:', course.id);
  console.log('Title:', course.title);
  console.log('Status:', course.status);
  console.log('\n=== User Details ===');
  console.log('User ID:', course.user.id);
  console.log('Name:', course.user.name);
  console.log('Email:', course.user.email);
  console.log('Email Verified:', course.user.emailVerified);
  console.log('Role:', course.user.role);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
