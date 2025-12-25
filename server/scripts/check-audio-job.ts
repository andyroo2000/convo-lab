/**
 * Check audio generation job status in production
 */

import { prisma } from '../src/db/client.js';

const jobId = process.argv[2] ? parseInt(process.argv[2]) : undefined;

console.log('Prisma object:', prisma);
console.log('Prisma keys:', Object.keys(prisma || {}));

async function checkAudioJob() {
  console.log('🔍 Checking audio generation jobs...\n');

  try {
    // Check specific job if provided
    if (jobId) {
      const job = await prisma.audioGenerationJob.findUnique({
        where: { id: jobId },
        include: {
          episode: {
            select: { id: true, title: true },
          },
        },
      });

      if (!job) {
        console.log(`❌ Job ${jobId} not found`);
      } else {
        console.log(`📋 Job #${job.id}:`);
        console.log(`   Episode: ${job.episode?.title || 'N/A'}`);
        console.log(`   State: ${job.state}`);
        console.log(`   Progress: ${job.progress}%`);
        console.log(`   Created: ${job.createdAt}`);
        console.log(`   Updated: ${job.updatedAt}`);
        if (job.error) {
          console.log(`   Error: ${job.error}`);
        }
        console.log('');
      }
    }

    // Show recent jobs
    console.log('📊 Recent audio generation jobs:\n');
    const recentJobs = await prisma.audioGenerationJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        episode: {
          select: { id: true, title: true },
        },
      },
    });

    recentJobs.forEach((job) => {
      const status =
        job.state === 'completed'
          ? '✅'
          : job.state === 'failed'
            ? '❌'
            : job.state === 'processing'
              ? '⏳'
              : '⏸️';
      console.log(`${status} Job #${job.id} - ${job.state} (${job.progress}%)`);
      console.log(`   Episode: ${job.episode?.title || 'N/A'}`);
      console.log(`   Created: ${job.createdAt.toISOString()}`);
      if (job.error) {
        console.log(`   Error: ${job.error.substring(0, 100)}...`);
      }
      console.log('');
    });

    // Summary
    const counts = await prisma.audioGenerationJob.groupBy({
      by: ['state'],
      _count: true,
    });

    console.log('━'.repeat(60));
    console.log('📈 Job State Summary:');
    counts.forEach((c) => {
      console.log(`   ${c.state}: ${c._count}`);
    });
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAudioJob();
