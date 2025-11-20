#!/usr/bin/env node
import { prisma } from '../db/client.js';
import { courseQueue } from '../jobs/courseQueue.js';

/**
 * Cleanup script for stuck or duplicate lessons
 *
 * This script helps fix issues where:
 * - Lessons are stuck in "generating" status
 * - Duplicate lessons exist for the same course
 * - Jobs failed without updating lesson status
 */

async function cleanupStuckLessons() {
  console.log('🔍 Searching for stuck or duplicate lessons...\n');

  try {
    // Find all courses with lessons
    const courses = await prisma.course.findMany({
      include: {
        lessons: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    let totalFixed = 0;

    for (const course of courses) {
      const generatingLessons = course.lessons.filter(l => l.status === 'generating');
      const pendingLessons = course.lessons.filter(l => l.status === 'pending');
      const readyLessons = course.lessons.filter(l => l.status === 'ready');

      // Check for duplicate lessons with same order number
      const lessonsByOrder = new Map<number, typeof course.lessons>();
      for (const lesson of course.lessons) {
        if (!lessonsByOrder.has(lesson.order)) {
          lessonsByOrder.set(lesson.order, []);
        }
        lessonsByOrder.get(lesson.order)!.push(lesson);
      }

      const duplicates = Array.from(lessonsByOrder.entries()).filter(([_, lessons]) => lessons.length > 1);

      if (generatingLessons.length > 1 || pendingLessons.length > 1 || duplicates.length > 0) {
        console.log(`📦 Course: ${course.title} (${course.id})`);
        console.log(`   Total lessons: ${course.lessons.length}`);
        console.log(`   Generating: ${generatingLessons.length}, Pending: ${pendingLessons.length}, Ready: ${readyLessons.length}`);

        // Handle duplicates
        if (duplicates.length > 0) {
          console.log(`   ⚠️  Found ${duplicates.length} duplicate lesson sets`);

          for (const [order, lessons] of duplicates) {
            console.log(`   Duplicate lessons for order ${order}:`);

            // Sort by status priority: ready > generating > pending > error
            const statusPriority: Record<string, number> = {
              ready: 0,
              generating: 1,
              pending: 2,
              error: 3
            };

            lessons.sort((a, b) => {
              const aPriority = statusPriority[a.status] ?? 999;
              const bPriority = statusPriority[b.status] ?? 999;
              return aPriority - bPriority;
            });

            // Keep the first one (best status), delete the rest
            const toKeep = lessons[0];
            const toDelete = lessons.slice(1);

            console.log(`     ✅ Keeping: ${toKeep.id} (${toKeep.status})`);
            for (const lesson of toDelete) {
              console.log(`     ❌ Deleting: ${lesson.id} (${lesson.status})`);

              // Delete core items first
              await prisma.lessonCoreItem.deleteMany({
                where: { lessonId: lesson.id },
              });

              // Delete lesson
              await prisma.lesson.delete({
                where: { id: lesson.id },
              });

              totalFixed++;
            }
          }
        }

        // Check for stuck jobs
        const activeJobs = await courseQueue.getJobs(['active', 'waiting', 'failed', 'delayed']);
        const courseJobs = activeJobs.filter(j => j.data.courseId === course.id);

        if (courseJobs.length > 0) {
          console.log(`   ⚠️  Found ${courseJobs.length} active/failed jobs for this course`);

          for (const job of courseJobs) {
            const state = await job.getState();
            console.log(`     Job ${job.id}: ${state}`);

            if (state === 'failed' || (state as string) === 'stuck') {
              console.log(`     ❌ Removing failed/stuck job ${job.id}`);
              await job.remove();
            }
          }
        }

        console.log('');
      }
    }

    // Find lessons stuck in "generating" for more than 30 minutes
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const stuckLessons = await prisma.lesson.findMany({
      where: {
        status: 'generating',
        updatedAt: {
          lt: thirtyMinutesAgo,
        },
      },
      include: {
        course: true,
      },
    });

    if (stuckLessons.length > 0) {
      console.log(`\n⚠️  Found ${stuckLessons.length} lessons stuck in "generating" for > 30 minutes:\n`);

      for (const lesson of stuckLessons) {
        console.log(`   Course: ${lesson.course.title}`);
        console.log(`   Lesson: ${lesson.title} (${lesson.id})`);
        console.log(`   Last updated: ${lesson.updatedAt.toLocaleString()}`);
        console.log(`   Status: ${lesson.status}`);

        // Check if there's still a job for this
        const activeJobs = await courseQueue.getJobs(['active', 'waiting']);
        const hasActiveJob = activeJobs.some(j => j.data.courseId === lesson.courseId);

        if (!hasActiveJob) {
          console.log(`   ❌ No active job found - marking as error`);
          await prisma.lesson.update({
            where: { id: lesson.id },
            data: { status: 'error' },
          });
          totalFixed++;
        } else {
          console.log(`   ⏳ Active job still running - leaving as is`);
        }

        console.log('');
      }
    }

    console.log(`\n✅ Cleanup complete! Fixed ${totalFixed} issues.`);

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

// Run cleanup
cleanupStuckLessons();
