#!/usr/bin/env tsx
/* eslint-disable no-console */
/**
 * Sync Arabic avatar URLs from local to production by matching speaker names
 * Usage: npx tsx scripts/sync-arabic-avatars.ts
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

async function syncArabicAvatars() {
  try {
    console.log('🔍 Fetching Arabic speakers from local...');

    // Get all Arabic speakers with avatars from local
    const localSpeakers = await localPrisma.speaker.findMany({
      where: {
        dialogue: {
          episode: {
            targetLanguage: 'ar',
            isSampleContent: true,
          },
        },
        avatarUrl: { not: null },
      },
      distinct: ['name', 'proficiency', 'gender'],
    });

    console.log(`📦 Found ${localSpeakers.length} unique Arabic speakers with avatars in local\n`);

    // Get all Arabic speakers without avatars from production
    const prodSpeakers = await prodPrisma.speaker.findMany({
      where: {
        dialogue: {
          episode: {
            targetLanguage: 'ar',
            isSampleContent: true,
          },
        },
        avatarUrl: null,
      },
    });

    console.log(`🔍 Found ${prodSpeakers.length} Arabic speakers WITHOUT avatars in production\n`);

    let updated = 0;
    let notFound = 0;

    for (const prodSpeaker of prodSpeakers) {
      // Find matching speaker in local by name, proficiency, and gender
      const matchingLocal = localSpeakers.find(
        (ls) =>
          ls.name === prodSpeaker.name &&
          ls.proficiency === prodSpeaker.proficiency &&
          ls.gender === prodSpeaker.gender
      );

      if (matchingLocal && matchingLocal.avatarUrl) {
        await prodPrisma.speaker.update({
          where: { id: prodSpeaker.id },
          data: { avatarUrl: matchingLocal.avatarUrl },
        });

        console.log(
          `✅ Updated "${prodSpeaker.name}" (${prodSpeaker.proficiency}, ${prodSpeaker.gender})`
        );
        updated++;
      } else {
        console.log(
          `⏭️  No match found for "${prodSpeaker.name}" (${prodSpeaker.proficiency}, ${prodSpeaker.gender})`
        );
        notFound++;
      }
    }

    console.log(`\n✨ Avatar sync complete!`);
    console.log(`   - Updated: ${updated} avatars`);
    console.log(`   - Not found: ${notFound} speakers`);
  } catch (error) {
    console.error('❌ Sync failed:', error);
    throw error;
  } finally {
    await localPrisma.$disconnect();
    await prodPrisma.$disconnect();
  }
}

// Run sync
syncArabicAvatars()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error:', error);
    process.exit(1);
  });
