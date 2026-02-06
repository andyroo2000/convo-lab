#!/usr/bin/env tsx
/* eslint-disable no-console */
/**
 * Backfill furigana for dialogue sentences
 * Usage: PROD_DATABASE_URL="..." FURIGANA_SERVICE_URL="..." npx tsx scripts/backfill-dialogue-furigana.ts [--user-id=xxx]
 */

import { PrismaClient } from '@prisma/client';
import type { LanguageMetadata } from '../src/services/languageProcessor.js';

const userIdArg = process.argv.find((arg) => arg.startsWith('--user-id='));
const userId = userIdArg ? userIdArg.split('=')[1] : undefined;

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.PROD_DATABASE_URL || process.env.DATABASE_URL,
    },
  },
});

async function backfillDialogueFurigana() {
  try {
    console.log('[FURIGANA] Starting dialogue furigana backfill...');

    if (userId) {
      console.log(`[FURIGANA] Filtering to user ID: ${userId}`);
    }

    // Find all Japanese episodes with dialogues
    const episodes = await prisma.episode.findMany({
      where: {
        targetLanguage: 'ja',
        dialogue: { isNot: null },
        ...(userId && { userId }),
      },
      include: {
        dialogue: {
          include: {
            sentences: true,
          },
        },
      },
    });

    console.log(`[FURIGANA] Found ${episodes.length} Japanese episodes\n`);

    let totalSentences = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const episode of episodes) {
      if (!episode.dialogue) continue;

      console.log(`Processing: "${episode.title}" (${episode.dialogue.sentences.length} sentences)`);

      for (const sentence of episode.dialogue.sentences) {
        totalSentences++;

        const metadata = sentence.metadata as LanguageMetadata;

        // Check if furigana already has brackets (properly generated)
        if (
          metadata?.japanese?.furigana &&
          metadata.japanese.furigana.includes('[') &&
          metadata.japanese.furigana.includes(']')
        ) {
          skipped++;
          continue;
        }

        try {
          // Generate furigana using the furigana microservice
          const furiganaServiceUrl =
            process.env.FURIGANA_SERVICE_URL || 'https://furigana-5q7eg4sina-uc.a.run.app';

          const response = await fetch(`${furiganaServiceUrl}/furigana`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: sentence.text }),
          });

          if (!response.ok) {
            throw new Error(`Furigana service returned ${response.status}`);
          }

          const result = await response.json();
          const furigana = result.furigana || sentence.text;

          // Update metadata
          const updatedMetadata = {
            ...metadata,
            japanese: {
              ...(metadata?.japanese || {}),
              kanji: sentence.text,
              kana: metadata?.japanese?.kana || '',
              furigana: furigana,
            },
          };

          await prisma.sentence.update({
            where: { id: sentence.id },
            data: { metadata: updatedMetadata },
          });

          console.log(`  ✅ "${sentence.text.substring(0, 40)}..." → ${furigana.substring(0, 60)}...`);
          updated++;
        } catch (error) {
          console.error(`  ❌ Failed to update sentence: ${sentence.text}`);
          console.error(`     Error:`, error);
          errors++;
        }
      }

      console.log();
    }

    console.log('✨ Backfill complete!');
    console.log(`   - Total sentences: ${totalSentences}`);
    console.log(`   - Updated: ${updated}`);
    console.log(`   - Skipped (already had furigana): ${skipped}`);
    console.log(`   - Errors: ${errors}`);
  } catch (error) {
    console.error('❌ Backfill failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

backfillDialogueFurigana()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error:', error);
    process.exit(1);
  });
