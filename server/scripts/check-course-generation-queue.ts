import { Queue } from 'bullmq';
import { createRedisConnection } from '../src/config/redis.js';

async function main() {
  const connection = createRedisConnection();
  const courseQueue = new Queue('course-generation', { connection });

  const [waiting, active, completed, failed] = await Promise.all([
    courseQueue.getWaitingCount(),
    courseQueue.getActiveCount(),
    courseQueue.getCompletedCount(),
    courseQueue.getFailedCount(),
  ]);

  console.log('\n📊 Course-Generation Queue Status:');
  console.log(`  Waiting: ${waiting}`);
  console.log(`  Active: ${active}`);
  console.log(`  Completed: ${completed}`);
  console.log(`  Failed: ${failed}`);

  if (active > 0) {
    console.log('\n⚙️  Active Jobs:');
    const activeJobs = await courseQueue.getActive(0, 5);
    for (const job of activeJobs) {
      console.log(`\n  Job #${job.id}:`);
      console.log(`    Name: ${job.name}`);
      console.log(`    Progress: ${job.progress || 0}%`);
      console.log(`    Course ID: ${job.data.courseId}`);
    }
  }

  if (waiting > 0) {
    console.log('\n⏳ Waiting Jobs:');
    const waitingJobs = await courseQueue.getWaiting(0, 5);
    for (const job of waitingJobs) {
      console.log(`\n  Job #${job.id}:`);
      console.log(`    Name: ${job.name}`);
      console.log(`    Course ID: ${job.data.courseId}`);
    }
  }

  if (failed > 0) {
    console.log('\n❌ Recent Failed Jobs:');
    const failedJobs = await courseQueue.getFailed(0, 3);
    for (const job of failedJobs) {
      console.log(`\n  Job #${job.id}:`);
      console.log(`    Name: ${job.name}`);
      console.log(`    Course ID: ${job.data.courseId}`);
      console.log(`    Failed Reason:`, job.failedReason?.substring(0, 200));
    }
  }

  await courseQueue.close();
  await connection.quit();
}

main().catch(console.error);
