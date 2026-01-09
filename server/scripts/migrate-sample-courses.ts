#!/usr/bin/env tsx
/* eslint-disable no-console */
/**
 * Migration script to copy sample courses from local to production
 * Usage: npx tsx scripts/migrate-sample-courses.ts
 */

import { PrismaClient } from '@prisma/client';

const localPrisma = new PrismaClient();
const prodPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.PROD_DATABASE_URL,
    },
  },
});

async function migrateSampleCourses() {
  try {
    console.log('🔍 Finding system user in production...');

    // Get the system user from production (owner of sample content)
    const prodSystemUser = await prodPrisma.user.findUnique({
      where: { email: 'system@languageflow.app' },
    });

    if (!prodSystemUser) {
      throw new Error('system@languageflow.app user not found in production!');
    }

    console.log(`✅ Found system user in production: ${prodSystemUser.id}`);
    console.log('🔍 Fetching sample courses from local database...');

    // Get all sample courses with their related data
    const localCourses = await localPrisma.course.findMany({
      where: {
        isSampleContent: true,
      },
      include: {
        courseEpisodes: {
          orderBy: { order: 'asc' },
          include: {
            episode: true,
          },
        },
        coreItems: {
          orderBy: { complexityScore: 'asc' },
        },
      },
    });

    console.log(`📦 Found ${localCourses.length} sample courses in local database`);

    if (localCourses.length === 0) {
      console.log('⚠️  No sample courses found in local database');
      return;
    }

    console.log('\n🚀 Starting migration to production...\n');

    let migrated = 0;
    let skipped = 0;

    for (const course of localCourses) {
      // Check if course already exists in production
      const existingCourse = await prodPrisma.course.findFirst({
        where: {
          title: course.title,
          targetLanguage: course.targetLanguage,
          proficiencyLevel: course.proficiencyLevel,
          isSampleContent: true,
        },
      });

      if (existingCourse) {
        console.log(`⏭️  Skipping "${course.title}" (${course.targetLanguage}) - already exists`);
        skipped++;
        continue;
      }

      console.log(`📝 Migrating "${course.title}" (${course.targetLanguage})...`);

      // Create course with core items and course episodes
      const { courseEpisodes, coreItems, ...courseData } = course;

      await prodPrisma.course.create({
        data: {
          ...courseData,
          id: undefined, // Let Prisma generate new ID
          userId: prodSystemUser.id, // Use production system user ID
          coreItems: {
            create: coreItems.map((item) => ({
              textL2: item.textL2,
              readingL2: item.readingL2,
              translationL1: item.translationL1,
              complexityScore: item.complexityScore,
              sourceEpisodeId: item.sourceEpisodeId,
              sourceSentenceId: item.sourceSentenceId,
              components: item.components,
              // sourceUnitIndex: omitted - not in production schema yet
            })),
          },
          // courseEpisodes: skip for now - episodes may not exist in production
          // The course content is complete in scriptJson and audioUrl
        },
      });

      migrated++;
      console.log(`✅ Migrated "${course.title}"`);
    }

    console.log(`\n✨ Migration complete!`);
    console.log(`   - Migrated: ${migrated} courses`);
    console.log(`   - Skipped: ${skipped} courses (already exist)`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await localPrisma.$disconnect();
    await prodPrisma.$disconnect();
  }
}

// Run migration
migrateSampleCourses()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error:', error);
    process.exit(1);
  });
