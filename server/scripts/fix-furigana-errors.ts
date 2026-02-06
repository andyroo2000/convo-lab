#!/usr/bin/env tsx
/* eslint-disable no-console */
/**
 * Fix common furigana errors in dialogue sentences
 * Usage: PROD_DATABASE_URL="..." npx tsx scripts/fix-furigana-errors.ts [--user-id=xxx]
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

// Common furigana correction patterns
const corrections = [
  // この前 should be このまえ, not このぜん
  { pattern: /この前\[ぜん\]/g, replacement: 'この前[まえ]' },

  // 何 readings - should be なに before particles を、か、が、も and in casual contexts
  { pattern: /何\[なん\]を/g, replacement: '何[なに]を' },
  { pattern: /何\[なん\]か/g, replacement: '何[なに]か' },
  { pattern: /何\[なん\]が/g, replacement: '何[なに]が' },
  { pattern: /何\[なん\]も/g, replacement: '何[なに]も' },
  { pattern: /何\[なん\]する/g, replacement: '何[なに]する' },

  // 私 should be わたし in casual contexts, not わたくし
  // These dialogues are all casual conversations for language learners
  { pattern: /私\[わたくし\]/g, replacement: '私[わたし]' },

  // 今日 should be きょう, not こんにち
  { pattern: /今日\[こんにち\]/g, replacement: '今日[きょう]' },

  // 明日 should be あした, not みょうにち
  { pattern: /明日\[みょうにち\]/g, replacement: '明日[あした]' },
  { pattern: /明日\[みょうじつ\]/g, replacement: '明日[あした]' },

  // 一緒 should be いっしょ, not いちしょ
  { pattern: /一緒\[いちしょ\]/g, replacement: '一緒[いっしょ]' },

  // 大丈夫 should be だいじょうぶ
  { pattern: /大丈夫\[だいじょぶ\]/g, replacement: '大丈夫[だいじょうぶ]' },

  // 勉強 should be べんきょう
  { pattern: /勉強\[べんきょ\]/g, replacement: '勉強[べんきょう]' },
];

async function fixFuriganaErrors() {
  try {
    console.log('[FIX] Starting furigana error correction...\n');

    if (userId) {
      console.log(`[FIX] Filtering to user ID: ${userId}`);
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

    console.log(`[FIX] Found ${episodes.length} Japanese episodes\n`);

    let totalSentences = 0;
    let fixed = 0;
    let unchanged = 0;

    for (const episode of episodes) {
      if (!episode.dialogue) continue;

      let episodeHadFixes = false;

      for (const sentence of episode.dialogue.sentences) {
        totalSentences++;

        const metadata = sentence.metadata as LanguageMetadata;
        const originalFurigana = metadata?.japanese?.furigana;

        if (!originalFurigana) {
          unchanged++;
          continue;
        }

        let correctedFurigana = originalFurigana;
        let hadCorrections = false;

        // Apply all correction patterns
        for (const { pattern, replacement } of corrections) {
          const before = correctedFurigana;
          correctedFurigana = correctedFurigana.replace(pattern, replacement);
          if (before !== correctedFurigana) {
            hadCorrections = true;
          }
        }

        if (hadCorrections) {
          if (!episodeHadFixes) {
            console.log(`\nProcessing: "${episode.title}"`);
            episodeHadFixes = true;
          }

          // Update metadata
          const updatedMetadata = {
            ...metadata,
            japanese: {
              ...(metadata?.japanese || {}),
              furigana: correctedFurigana,
            },
          };

          await prisma.sentence.update({
            where: { id: sentence.id },
            data: { metadata: updatedMetadata },
          });

          console.log(`  ✅ ${sentence.text.substring(0, 40)}...`);
          console.log(`     Before: ${originalFurigana.substring(0, 80)}...`);
          console.log(`     After:  ${correctedFurigana.substring(0, 80)}...`);

          fixed++;
        } else {
          unchanged++;
        }
      }
    }

    console.log('\n✨ Correction complete!');
    console.log(`   - Total sentences: ${totalSentences}`);
    console.log(`   - Fixed: ${fixed}`);
    console.log(`   - Unchanged: ${unchanged}`);
  } catch (error: unknown) {
    console.error('❌ Fix failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixFuriganaErrors()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error('\n💥 Error:', error);
    process.exit(1);
  });
