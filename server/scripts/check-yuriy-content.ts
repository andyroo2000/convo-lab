import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Load production environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../..', '.env.production') });

const prisma = new PrismaClient();

async function checkYuriyContent() {
  try {
    console.log('🔍 Searching for Yuriy\'s account...\n');

    // Find Yuriy's user account (try common email patterns)
    let users = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: 'yuriy', mode: 'insensitive' } },
          { email: { contains: 'yuri', mode: 'insensitive' } },
          { name: { contains: 'yuriy', mode: 'insensitive' } },
          { name: { contains: 'yuri', mode: 'insensitive' } },
        ]
      },
      select: {
        id: true,
        email: true,
        name: true,
        displayName: true,
        createdAt: true,
      }
    });

    if (users.length === 0) {
      console.log('❌ No user found matching "Yuriy". Looking for users with recent generation activity...\n');

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Find users who have generated content recently
      const recentLogs = await prisma.generationLog.findMany({
        where: {
          createdAt: { gte: sevenDaysAgo }
        },
        select: {
          userId: true,
          contentType: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' }
      });

      if (recentLogs.length === 0) {
        console.log('No generation activity in the last 7 days.');

        // Check for any courses with error status
        console.log('\nLooking for courses with error status...\n');
        const errorCourses = await prisma.course.findMany({
          where: { status: 'error' },
          select: {
            id: true,
            userId: true,
            title: true,
            createdAt: true,
            user: {
              select: {
                email: true,
                name: true,
                displayName: true,
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        });

        if (errorCourses.length > 0) {
          console.log(`Found ${errorCourses.length} courses with error status:`);
          const userIds = new Set<string>();
          errorCourses.forEach(course => {
            console.log(`  - "${course.title}" by ${course.user.email} - ${course.createdAt.toISOString()}`);
            userIds.add(course.userId);
          });

          // Get full user details
          users = await prisma.user.findMany({
            where: { id: { in: Array.from(userIds) } },
            select: {
              id: true,
              email: true,
              name: true,
              displayName: true,
              createdAt: true,
            }
          });
        } else {
          console.log('No courses with error status found.');
          return;
        }
      } else {
        const uniqueUserIds = [...new Set(recentLogs.map(log => log.userId))];
        console.log(`Found ${recentLogs.length} generation attempts from ${uniqueUserIds.length} users in the last 7 days.`);

        users = await prisma.user.findMany({
          where: { id: { in: uniqueUserIds } },
          select: {
            id: true,
            email: true,
            name: true,
            displayName: true,
            createdAt: true,
          }
        });
      }
    }

    console.log(`✅ Found ${users.length} potential user(s):`);
    users.forEach(user => {
      console.log(`  - ${user.email} (${user.name || user.displayName}) - Created: ${user.createdAt.toISOString()}`);
    });
    console.log();

    // Check content for each user
    for (const user of users) {
      console.log(`\n📊 Checking content for ${user.email}...\n`);

      // Check Episodes (Dialogs)
      const episodes = await prisma.episode.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          title: true,
          status: true,
          targetLanguage: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' }
      });

      console.log(`📝 Episodes/Dialogs: ${episodes.length}`);
      if (episodes.length > 0) {
        episodes.forEach(ep => {
          console.log(`  - "${ep.title}" (${ep.status}) - ${ep.targetLanguage} - Created: ${ep.createdAt.toISOString()}`);
        });
      }
      console.log();

      // Check Courses
      const courses = await prisma.course.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          title: true,
          status: true,
          targetLanguage: true,
          createdAt: true,
          description: true,
        },
        orderBy: { createdAt: 'desc' }
      });

      console.log(`🎓 Audio Courses: ${courses.length}`);
      if (courses.length > 0) {
        courses.forEach(course => {
          console.log(`  - "${course.title}" (${course.status}) - ${course.targetLanguage} - Created: ${course.createdAt.toISOString()}`);
          if (course.description) {
            console.log(`    Description: ${course.description.substring(0, 100)}${course.description.length > 100 ? '...' : ''}`);
          }
        });
      }
      console.log();

      // Check Generation Logs to see all attempts
      const genLogs = await prisma.generationLog.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          contentType: true,
          contentId: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' }
      });

      console.log(`📋 Generation Log Entries: ${genLogs.length}`);
      if (genLogs.length > 0) {
        const logCounts = genLogs.reduce((acc, log) => {
          acc[log.contentType] = (acc[log.contentType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        console.log('  Breakdown by content type:');
        Object.entries(logCounts).forEach(([type, count]) => {
          console.log(`    - ${type}: ${count}`);
        });

        console.log('\n  Recent attempts:');
        genLogs.slice(0, 10).forEach(log => {
          console.log(`    - ${log.contentType} - ${log.createdAt.toISOString()}`);
        });
      }
      console.log();

      // Summary
      const totalContent = episodes.length + courses.length;
      console.log(`\n📊 Summary for ${user.email}:`);
      console.log(`  Total content pieces: ${totalContent}`);
      console.log(`  Total generation attempts: ${genLogs.length}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkYuriyContent();
