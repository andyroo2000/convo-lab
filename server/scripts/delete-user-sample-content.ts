#!/usr/bin/env tsx
/* eslint-disable no-console */
/**
 * Delete all sample content from a specific user's library
 * Usage: PROD_DATABASE_URL="..." npx tsx scripts/delete-user-sample-content.ts <email>
 */

import { PrismaClient } from '@prisma/client';

const email = process.argv[2];

if (!email) {
  console.error('❌ Error: Email argument required');
  console.log('Usage: npx tsx scripts/delete-user-sample-content.ts <email>');
  process.exit(1);
}

const prodPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.PROD_DATABASE_URL,
    },
  },
});

async function deleteSampleContent() {
  try {
    console.log(`🔍 Finding user: ${email}...`);

    const user = await prodPrisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.error(`❌ User not found: ${email}`);
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.email} (${user.id})\n`);

    // Get all sample episodes for this user
    const sampleEpisodes = await prodPrisma.episode.findMany({
      where: {
        userId: user.id,
        isSampleContent: true,
      },
      include: {
        dialogue: {
          include: {
            speakers: true,
            sentences: true,
          },
        },
      },
    });

    // Get all sample courses for this user
    const sampleCourses = await prodPrisma.course.findMany({
      where: {
        userId: user.id,
        isSampleContent: true,
      },
    });

    console.log(`📊 Found:`);
    console.log(`   - ${sampleEpisodes.length} sample dialogues`);
    console.log(`   - ${sampleCourses.length} sample courses\n`);

    if (sampleEpisodes.length === 0 && sampleCourses.length === 0) {
      console.log('✨ No sample content to delete!');
      return;
    }

    // Show what will be deleted
    if (sampleEpisodes.length > 0) {
      console.log('🗑️  Dialogues to be deleted:');
      const byLanguage: Record<string, number> = {};
      for (const ep of sampleEpisodes) {
        byLanguage[ep.targetLanguage] = (byLanguage[ep.targetLanguage] || 0) + 1;
      }
      for (const [lang, count] of Object.entries(byLanguage)) {
        console.log(`   - ${lang}: ${count} dialogues`);
      }
      console.log();
    }

    if (sampleCourses.length > 0) {
      console.log('🗑️  Courses to be deleted:');
      for (const course of sampleCourses) {
        console.log(`   - ${course.title} (${course.targetLanguage})`);
      }
      console.log();
    }

    // Delete courses first (they reference episodes via CourseEpisode)
    if (sampleCourses.length > 0) {
      console.log('🗑️  Deleting sample courses...');
      const deletedCourses = await prodPrisma.course.deleteMany({
        where: {
          userId: user.id,
          isSampleContent: true,
        },
      });
      console.log(`✅ Deleted ${deletedCourses.count} courses\n`);
    }

    // Delete episodes (dialogues, speakers, sentences will cascade)
    if (sampleEpisodes.length > 0) {
      console.log('🗑️  Deleting sample dialogues...');
      const deletedEpisodes = await prodPrisma.episode.deleteMany({
        where: {
          userId: user.id,
          isSampleContent: true,
        },
      });
      console.log(`✅ Deleted ${deletedEpisodes.count} dialogues\n`);
    }

    console.log('✨ Sample content deletion complete!');
  } catch (error) {
    console.error('❌ Deletion failed:', error);
    throw error;
  } finally {
    await prodPrisma.$disconnect();
  }
}

// Run deletion
deleteSampleContent()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error:', error);
    process.exit(1);
  });
