#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

// Create Redis connection
const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  enableOfflineQueue: true,
  tls: process.env.REDIS_HOST?.includes('upstash.io') ? {} : undefined,
});

const courseQueue = new Queue('course-generation', { connection });

async function main() {
  const courseId = process.argv[2];

  if (!courseId) {
    console.error('Usage: npx tsx scripts/trigger-course-generation.ts <course-id>');
    process.exit(1);
  }

  // Get course details
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          emailVerified: true,
        },
      },
    },
  });

  if (!course) {
    console.error(`Course not found: ${courseId}`);
    process.exit(1);
  }

  console.log('\n=== Course Details ===');
  console.log('Course ID:', course.id);
  console.log('Title:', course.title);
  console.log('Status:', course.status);
  console.log('User:', course.user.email);
  console.log('Email Verified:', course.user.emailVerified);

  if (!course.user.emailVerified) {
    console.error('\n❌ User email is not verified. Cannot generate course.');
    process.exit(1);
  }

  if (course.status === 'generating') {
    console.log('\n⚠️  Course is already generating.');
    process.exit(0);
  }

  if (course.status === 'completed') {
    console.log('\n✅ Course is already completed.');
    process.exit(0);
  }

  console.log('\n🔄 Updating course status to "generating"...');

  await prisma.course.update({
    where: { id: courseId },
    data: { status: 'generating' },
  });

  console.log('✅ Status updated');

  console.log('\n🔄 Enqueueing course generation job...');

  const job = await courseQueue.add(
    'generate-course',
    {
      userId: course.userId,
      courseId: course.id,
    },
    {
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: false,
    }
  );

  console.log(`✅ Job enqueued: ${job.id}`);
  console.log('\n🎉 Course generation has been triggered!');
  console.log(`\nMonitor progress at: https://convo-lab.com/app/courses/${courseId}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await connection.quit();
  });
