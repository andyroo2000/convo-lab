#!/usr/bin/env node
import { courseQueue } from '../jobs/courseQueue.js';
import { prisma } from '../db/client.js';

async function cleanFailedJobs() {
  console.log('Cleaning up failed jobs...\n');

  const failedJobs = await courseQueue.getJobs(['failed']);

  console.log(`Found ${failedJobs.length} failed jobs.`);

  for (const job of failedJobs) {
    console.log(`Removing job ${job.id} (Course: ${job.data.courseId})`);
    await job.remove();
  }

  console.log(`\n✅ Cleaned up ${failedJobs.length} failed jobs.`);

  await prisma.$disconnect();
  process.exit(0);
}

cleanFailedJobs();
