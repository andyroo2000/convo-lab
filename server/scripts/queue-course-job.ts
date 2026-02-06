import { Queue } from 'bullmq';
import { createRedisConnection } from '../src/config/redis.js';

async function main() {
  const courseId = 'c6680268-078c-48fc-a249-467452def490';

  const connection = createRedisConnection();
  const courseQueue = new Queue('course-generation', { connection });

  const job = await courseQueue.add(
    'generate-course',
    {
      courseId,
      userId: '738cbf95-20d0-4e59-a32c-cb6cde970d46',
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

  console.log(`✅ Course generation job queued: Job #${job.id}`);
  console.log(`   Course ID: ${courseId}`);

  await courseQueue.close();
  await connection.quit();
}

main().catch(console.error);
