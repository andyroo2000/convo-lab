import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import { createRedisConnection } from '../src/config/redis.js';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  const userId = '738cbf95-20d0-4e59-a32c-cb6cde970d46'; // Yuriy

  console.log('\n=== Regenerating Course ===\n');

  // Create course record
  const course = await prisma.course.create({
    data: {
      userId,
      title: 'Conversation with flight attendants on the way to Japan',
      description:
        'Prepare for your Japan adventure by mastering essential travel phrases, starting with realistic conversations with flight attendants on your way to Tokyo. Our interactive audio course uses spaced repetition to help you speak confidently and naturally.',
      nativeLanguage: 'en',
      targetLanguage: 'ja',
      jlptLevel: 'N4',
      maxLessonDurationMinutes: 30,
      l1VoiceId: 'en-US-Neural2-J',
      l1VoiceProvider: 'google',
      speaker1VoiceId: 'ja-JP-Neural2-B',
      speaker1VoiceProvider: 'google',
      speaker1Gender: 'male',
      speaker2VoiceId: 'ja-JP-Neural2-C',
      speaker2VoiceProvider: 'google',
      speaker2Gender: 'female',
      status: 'generating',
    },
  });

  console.log('✅ Course created:');
  console.log(`   ID: ${course.id}`);
  console.log(`   Title: ${course.title}`);
  console.log(`   Status: ${course.status}`);

  // Queue the course generation job
  const connection = createRedisConnection();
  const courseQueue = new Queue('course-generation', { connection });

  const job = await courseQueue.add(
    'generate-course',
    {
      courseId: course.id,
      userId: course.userId,
      prompt: 'Conversation with flight attendants on the way to Japan',
      nativeLanguage: 'en',
      targetLanguage: 'ja',
      jlptLevel: 'N4',
      maxLessonDurationMinutes: 30,
    },
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    }
  );

  console.log(`\n✅ Course generation job queued: Job #${job.id}`);
  console.log(`\nMonitor progress at:`);
  console.log(`  https://convo-lab.com/app/course/${course.id}`);

  await courseQueue.close();
  await connection.quit();
  await prisma.$disconnect();
}

main().catch(console.error);
