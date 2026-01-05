/**
 * Backfill script to add furigana to existing cards
 *
 * This script finds all cards that have sentenceL2 but no sentenceReadingL2,
 * and generates the furigana using kuroshiro.
 *
 * Usage:
 *   npm run backfill:furigana
 */

import { PrismaClient } from '@prisma/client';
import { addReadingBrackets } from '../src/services/furiganaService.js';

const prisma = new PrismaClient();

async function backfillSentenceFurigana() {
  console.log('[Backfill] Starting sentence furigana backfill...');

  // Find all cards with sentences but no sentence reading
  const cardsToUpdate = await prisma.card.findMany({
    where: {
      sentenceL2: { not: null },
      sentenceReadingL2: null,
    },
    include: {
      deck: {
        select: {
          language: true,
        },
      },
    },
  });

  console.log(`[Backfill] Found ${cardsToUpdate.length} cards to update`);

  let successCount = 0;
  let errorCount = 0;

  for (const card of cardsToUpdate) {
    try {
      const sentenceReading = await addReadingBrackets(
        card.sentenceL2!,
        card.deck.language
      );

      await prisma.card.update({
        where: { id: card.id },
        data: { sentenceReadingL2: sentenceReading },
      });

      console.log(`[Backfill] ✓ Updated card ${card.id}: "${card.sentenceL2}" → "${sentenceReading}"`);
      successCount++;
    } catch (error) {
      console.error(`[Backfill] ✗ Failed to update card ${card.id}:`, error);
      errorCount++;
    }
  }

  console.log('\n[Backfill] Backfill complete!');
  console.log(`  Success: ${successCount}`);
  console.log(`  Errors: ${errorCount}`);
  console.log(`  Total: ${cardsToUpdate.length}`);
}

backfillSentenceFurigana()
  .catch((error) => {
    console.error('[Backfill] Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
