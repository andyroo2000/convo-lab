#!/usr/bin/env tsx
/* eslint-disable no-console */
/**
 * Migration script to copy sample dialogues from local to production
 * Usage: PROD_DATABASE_URL="..." npx tsx scripts/migrate-sample-dialogues.ts
 */

import { PrismaClient, Prisma } from '@prisma/client';

const localPrisma = new PrismaClient();
const prodPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.PROD_DATABASE_URL,
    },
  },
});

async function migrateSampleDialogues() {
  try {
    console.log('🔍 Finding system user in production...');

    // Get the system user from production
    const prodSystemUser = await prodPrisma.user.findUnique({
      where: { email: 'system@languageflow.app' },
    });

    if (!prodSystemUser) {
      throw new Error('system@languageflow.app user not found in production!');
    }

    console.log(`✅ Found system user in production: ${prodSystemUser.id}`);
    console.log('🔍 Fetching sample dialogues from local database...\n');

    // Get all sample episodes with dialogues from local
    const localEpisodes = await localPrisma.episode.findMany({
      where: {
        isSampleContent: true,
        dialogue: { isNot: null },
      },
      include: {
        dialogue: {
          include: {
            speakers: true,
            sentences: {
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    console.log(`📦 Found ${localEpisodes.length} sample dialogues in local database\n`);

    let migrated = 0;
    let skipped = 0;
    let languageStats: Record<string, number> = {};

    for (const localEpisode of localEpisodes) {
      // Check if episode already exists in production
      const existingEpisode = await prodPrisma.episode.findFirst({
        where: {
          userId: prodSystemUser.id,
          title: localEpisode.title,
          targetLanguage: localEpisode.targetLanguage,
          isSampleContent: true,
        },
      });

      if (existingEpisode) {
        console.log(
          `⏭️  Skipping "${localEpisode.title}" (${localEpisode.targetLanguage}) - already exists`
        );
        skipped++;
        continue;
      }

      console.log(`📝 Migrating "${localEpisode.title}" (${localEpisode.targetLanguage})...`);

      // Create episode
      const newEpisode = await prodPrisma.episode.create({
        data: {
          userId: prodSystemUser.id,
          title: localEpisode.title,
          sourceText: localEpisode.sourceText,
          targetLanguage: localEpisode.targetLanguage,
          nativeLanguage: localEpisode.nativeLanguage,
          status: localEpisode.status,
          audioUrl: localEpisode.audioUrl,
          audioSpeed: localEpisode.audioSpeed,
          audioUrl_0_7: localEpisode.audioUrl_0_7,
          audioUrl_0_85: localEpisode.audioUrl_0_85,
          audioUrl_1_0: localEpisode.audioUrl_1_0,
          isSampleContent: true,
        },
      });

      // Create dialogue if it exists
      if (localEpisode.dialogue) {
        const dialogue = localEpisode.dialogue;

        const newDialogue = await prodPrisma.dialogue.create({
          data: {
            episodeId: newEpisode.id,
          },
        });

        // Copy speakers
        const speakerIdMap = new Map<string, string>();
        for (const speaker of dialogue.speakers) {
          const newSpeaker = await prodPrisma.speaker.create({
            data: {
              dialogueId: newDialogue.id,
              name: speaker.name,
              voiceId: speaker.voiceId,
              voiceProvider: speaker.voiceProvider,
              proficiency: speaker.proficiency,
              tone: speaker.tone,
              gender: speaker.gender,
              color: speaker.color,
              avatarUrl: speaker.avatarUrl,
            },
          });
          speakerIdMap.set(speaker.id, newSpeaker.id);
        }

        // Copy sentences
        for (const sentence of dialogue.sentences) {
          const newSpeakerId = speakerIdMap.get(sentence.speakerId);
          if (!newSpeakerId) {
            console.error(`⚠️  Speaker not found for sentence: ${sentence.id}`);
            continue;
          }

          await prodPrisma.sentence.create({
            data: {
              dialogueId: newDialogue.id,
              speakerId: newSpeakerId,
              order: sentence.order,
              text: sentence.text,
              translation: sentence.translation,
              metadata: sentence.metadata as Prisma.JsonValue,
              audioUrl: sentence.audioUrl,
              startTime: sentence.startTime,
              endTime: sentence.endTime,
              startTime_0_7: sentence.startTime_0_7,
              endTime_0_7: sentence.endTime_0_7,
              startTime_0_85: sentence.startTime_0_85,
              endTime_0_85: sentence.endTime_0_85,
              startTime_1_0: sentence.startTime_1_0,
              endTime_1_0: sentence.endTime_1_0,
              variations: sentence.variations as Prisma.JsonValue,
              selected: sentence.selected,
            },
          });
        }

        console.log(
          `✅ Migrated "${localEpisode.title}" with ${dialogue.speakers.length} speakers and ${dialogue.sentences.length} sentences`
        );
      }

      // Track stats
      languageStats[localEpisode.targetLanguage] =
        (languageStats[localEpisode.targetLanguage] || 0) + 1;
      migrated++;
    }

    console.log(`\n✨ Migration complete!`);
    console.log(`   - Migrated: ${migrated} dialogues`);
    console.log(`   - Skipped: ${skipped} dialogues (already exist)`);
    console.log('\n📊 By language:');
    for (const [lang, count] of Object.entries(languageStats)) {
      console.log(`   - ${lang}: ${count} dialogues`);
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await localPrisma.$disconnect();
    await prodPrisma.$disconnect();
  }
}

// Run migration
migrateSampleDialogues()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error:', error);
    process.exit(1);
  });
