import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Load production environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../..', '.env.production') });

const prisma = new PrismaClient();

async function checkRecentCourses() {
  try {
    console.log('🔍 Checking all courses from the last 30 days...\n');

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const courses = await prisma.course.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo }
      },
      select: {
        id: true,
        title: true,
        status: true,
        targetLanguage: true,
        createdAt: true,
        updatedAt: true,
        description: true,
        user: {
          select: {
            email: true,
            name: true,
            displayName: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`📊 Total courses created in last 30 days: ${courses.length}\n`);

    if (courses.length === 0) {
      console.log('No courses found in the last 30 days.');

      // Check for any courses at all
      const allCoursesCount = await prisma.course.count();
      console.log(`\nTotal courses in database: ${allCoursesCount}`);

      if (allCoursesCount > 0) {
        const latestCourses = await prisma.course.findMany({
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
            user: {
              select: {
                email: true,
                name: true,
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 5
        });

        console.log('\nLatest 5 courses:');
        latestCourses.forEach(course => {
          console.log(`  - "${course.title}" (${course.status}) by ${course.user.email} - ${course.createdAt.toISOString()}`);
        });
      }
      return;
    }

    // Group by status
    const byStatus = courses.reduce((acc, course) => {
      acc[course.status] = acc[course.status] || [];
      acc[course.status].push(course);
      return acc;
    }, {} as Record<string, typeof courses>);

    console.log('📈 Breakdown by status:');
    Object.entries(byStatus).forEach(([status, coursesInStatus]) => {
      console.log(`  ${status}: ${coursesInStatus.length}`);
    });
    console.log();

    // Show all courses with details
    console.log('📚 All courses (most recent first):\n');
    courses.forEach(course => {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📖 "${course.title}"`);
      console.log(`   User: ${course.user.email} (${course.user.name || course.user.displayName || 'No name'})`);
      console.log(`   Status: ${course.status}`);
      console.log(`   Language: ${course.targetLanguage}`);
      console.log(`   Created: ${course.createdAt.toISOString()}`);
      console.log(`   Updated: ${course.updatedAt.toISOString()}`);
      if (course.description) {
        console.log(`   Description: ${course.description.substring(0, 150)}${course.description.length > 150 ? '...' : ''}`);
      }
      console.log();
    });

    // Check for other content types
    console.log('\n🔍 Checking other content types from last 30 days...\n');

    const episodes = await prisma.episode.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
        isSampleContent: false
      },
      select: {
        title: true,
        status: true,
        createdAt: true,
        user: {
          select: {
            email: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`📝 Dialogs: ${episodes.length}`);
    if (episodes.length > 0) {
      episodes.forEach(ep => {
        console.log(`  - "${ep.title}" (${ep.status}) by ${ep.user.email} - ${ep.createdAt.toISOString()}`);
      });
    }
    console.log();

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRecentCourses();
