#!/usr/bin/env tsx
/* eslint-disable no-console */
// Console logging is necessary for CLI script output
/**
 * Retry audio generation for a stuck course
 * Usage: npx tsx src/scripts/retry-course-audio.ts <courseId>
 */

import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';

import { createRedisConnection } from '../config/redis.js';

const prisma = new PrismaClient();
const connection = createRedisConnection();
const courseQueue = new Queue('course-audio-generation', { connection });

async function retryCourseAudio(courseId: string) {
  try {
    // Check course exists
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        title: true,
        status: true,
        audioUrl: true,
      },
    });

    if (!course) {
      console.error(`Course not found: ${courseId}`);
      process.exit(1);
    }

    console.log('Course found:');
    console.log(`  Title: ${course.title}`);
    console.log(`  Status: ${course.status}`);
    console.log(`  Audio URL: ${course.audioUrl || '(none)'}`);

    // Clear audio URL and set status to generating
    await prisma.course.update({
      where: { id: courseId },
      data: {
        audioUrl: null,
        status: 'generating',
      },
    });

    console.log('\n✓ Cleared audio URL and set status to generating');

    // Queue new generation job
    const job = await courseQueue.add(
      'generate-audio',
      { courseId },
      { removeOnComplete: true, removeOnFail: { age: 7 * 24 * 60 * 60 } }
    );

    console.log(`✓ Queued new generation job: #${job.id}`);
    console.log('\nDone! The course audio will regenerate shortly.');

    await prisma.$disconnect();
    await connection.quit();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

const courseId = process.argv[2];

if (!courseId) {
  console.error('Usage: npx tsx src/scripts/retry-course-audio.ts <courseId>');
  process.exit(1);
}

retryCourseAudio(courseId);
