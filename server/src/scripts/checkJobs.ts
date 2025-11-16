#!/usr/bin/env node
import { courseQueue } from '../jobs/courseQueue.js';
import { prisma } from '../db/client.js';

async function checkJobs() {
  console.log('Checking active jobs...\n');

  const activeJobs = await courseQueue.getJobs(['active', 'waiting', 'delayed', 'failed']);

  if (activeJobs.length === 0) {
    console.log('No active jobs found.');
  } else {
    for (const job of activeJobs) {
      const state = await job.getState();
      console.log(`Job ID: ${job.id}`);
      console.log(`State: ${state}`);
      console.log(`Course ID: ${job.data.courseId}`);
      console.log(`Progress: ${job.progress}%`);
      console.log('');
    }
  }

  // Check if the course in the DB is stuck
  const stuckCourse = await prisma.course.findFirst({
    where: {
      id: '02b1e7de-841b-4081-8f94-377655dd9c5c',
    },
    include: {
      lessons: true,
    },
  });

  if (stuckCourse) {
    console.log('Course status:', stuckCourse.status);
    console.log('Has active job:', activeJobs.some(j => j.data.courseId === stuckCourse.id));
  }

  await prisma.$disconnect();
  process.exit(0);
}

checkJobs();
