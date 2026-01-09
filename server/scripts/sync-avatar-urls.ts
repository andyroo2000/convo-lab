#!/usr/bin/env tsx
/* eslint-disable no-console */
/**
 * Sync avatar URLs from local to production for sample dialogues
 * Usage: npx tsx scripts/sync-avatar-urls.ts
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

async function syncAvatarUrls() {
  try {
    console.log('🔍 Fetching sample dialogues with avatars from local...');

    // Get all local sample dialogues with speaker avatars
    const localDialogues = await localPrisma.dialogue.findMany({
      where: {
        episode: {
          isSampleContent: true,
        },
      },
      include: {
        speakers: {
          where: {
            avatarUrl: { not: null },
          },
        },
        episode: {
          select: {
            title: true,
            targetLanguage: true,
          },
        },
      },
    });

    console.log(`📦 Found ${localDialogues.length} sample dialogues with avatars locally\n`);

    let updated = 0;
    let skipped = 0;

    for (const localDialogue of localDialogues) {
      // Find corresponding dialogue in production by matching episode title and language
      const prodDialogue = await prodPrisma.dialogue.findFirst({
        where: {
          episode: {
            title: localDialogue.episode.title,
            targetLanguage: localDialogue.episode.targetLanguage,
            isSampleContent: true,
          },
        },
        include: {
          speakers: true,
        },
      });

      if (!prodDialogue) {
        console.log(
          `⏭️  Skipping "${localDialogue.episode.title}" (${localDialogue.episode.targetLanguage}) - not found in production`
        );
        skipped++;
        continue;
      }

      // Update avatars for each speaker
      for (const localSpeaker of localDialogue.speakers) {
        if (!localSpeaker.avatarUrl) continue;

        // Find corresponding speaker in production by name
        const prodSpeaker = prodDialogue.speakers.find(
          (s) => s.name === localSpeaker.name && s.proficiency === localSpeaker.proficiency
        );

        if (!prodSpeaker) {
          console.log(
            `⏭️  Speaker "${localSpeaker.name}" not found in production dialogue "${localDialogue.episode.title}"`
          );
          continue;
        }

        // Update avatar URL if missing
        if (!prodSpeaker.avatarUrl) {
          await prodPrisma.speaker.update({
            where: { id: prodSpeaker.id },
            data: { avatarUrl: localSpeaker.avatarUrl },
          });

          console.log(
            `✅ Updated avatar for "${localSpeaker.name}" in "${localDialogue.episode.title}" (${localDialogue.episode.targetLanguage})`
          );
          updated++;
        } else {
          skipped++;
        }
      }
    }

    console.log(`\n✨ Avatar sync complete!`);
    console.log(`   - Updated: ${updated} avatars`);
    console.log(`   - Skipped: ${skipped} avatars (already set or not found)`);
  } catch (error) {
    console.error('❌ Sync failed:', error);
    throw error;
  } finally {
    await localPrisma.$disconnect();
    await prodPrisma.$disconnect();
  }
}

// Run sync
syncAvatarUrls()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error:', error);
    process.exit(1);
  });
