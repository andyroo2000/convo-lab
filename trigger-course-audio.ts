import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://languageflow:Kx9mP2vNwQ7bL5tRj8dF3hYzW6cM4nXs@34.57.57.13:5432/languageflow?schema=public',
    },
  },
});

const redis = new IORedis({
  host: 'bursting-flounder-33054.upstash.io',
  port: 6379,
  password: 'AYEeAAIncDIyMzc1ZGNjZDc0NGE0MjNlODIxNjllZTQyMzY3NTk4NnAyMzMwNTQ',
  maxRetriesPerRequest: null,
  tls: {},
});

async function main() {
  try {
    const courseQueue = new Queue('course-generation', { connection: redis });

    const courseId = process.argv[2];
    if (!courseId) {
      console.error('Usage: npx tsx trigger-course-audio.ts <courseId>');
      process.exit(1);
    }

    // Find the course
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

    console.log(`📝 Course: ${course.title} (${course.id})`);
    console.log(`   Status: ${course.status}`);
    console.log(`   Audio URL: ${course.audioUrl || '(none)'}`);

    // Clear audio URL and set status to generating
    await prisma.course.update({
      where: { id: courseId },
      data: {
        audioUrl: null,
        status: 'generating',
      },
    });

    console.log('\n✓ Cleared audio URL and set status to generating');

    // Queue audio generation job
    const job = await courseQueue.add(
      'generate-audio',
      { courseId },
      { removeOnComplete: true, removeOnFail: { age: 7 * 24 * 60 * 60 } }
    );

    console.log(`✓ Queued course audio generation job: #${job.id}`);
    console.log('\n✅ Done! The course audio will regenerate shortly.');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
    await redis.quit();
  }
}

main();
