/**
 * Backfill metadata for existing sentences
 *
 * This script processes all sentences that have empty metadata and computes
 * furigana/pinyin data for them. Safe to run multiple times (idempotent).
 *
 * Usage:
 *   npm run backfill:metadata
 */

// In production, import from dist; in dev, import from src
const isProd = process.env.NODE_ENV === 'production';
const basePath = isProd ? '../dist/server/src' : '../src';

const { prisma } = await import(`${basePath}/db/client.js`);
const { processLanguageText } = await import(`${basePath}/services/languageProcessor.js`);

interface SentenceWithEpisode {
  id: string;
  text: string;
  metadata: any;
  dialogue: {
    episode: {
      targetLanguage: string;
    };
  };
}

async function backfillMetadata() {
  console.log('🔍 Finding sentences with empty metadata...\n');

  try {
    // Find all sentences with empty metadata
    const sentences = await prisma.sentence.findMany({
      where: {
        OR: [
          { metadata: { equals: {} } },
          { metadata: { equals: null } },
        ],
      },
      include: {
        dialogue: {
          include: {
            episode: {
              select: {
                targetLanguage: true,
              },
            },
          },
        },
      },
    }) as SentenceWithEpisode[];

    if (sentences.length === 0) {
      console.log('✅ No sentences found with empty metadata. All done!\n');
      return;
    }

    console.log(`📊 Found ${sentences.length} sentences to process\n`);

    // Process in batches to avoid overwhelming the language processor
    const BATCH_SIZE = 10;
    let processed = 0;
    let updated = 0;
    let errors = 0;

    for (let i = 0; i < sentences.length; i += BATCH_SIZE) {
      const batch = sentences.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(sentences.length / BATCH_SIZE);

      console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} sentences)...`);

      // Process batch in parallel
      const results = await Promise.allSettled(
        batch.map(async (sentence) => {
          const targetLanguage = sentence.dialogue.episode.targetLanguage;

          // Skip if language doesn't need processing
          if (targetLanguage !== 'ja' && targetLanguage !== 'zh') {
            processed++;
            return { id: sentence.id, skipped: true };
          }

          try {
            // Compute metadata
            const metadata = await processLanguageText(sentence.text, targetLanguage);

            // Update database
            await prisma.sentence.update({
              where: { id: sentence.id },
              data: { metadata: metadata as any },
            });

            processed++;
            updated++;
            return { id: sentence.id, success: true };
          } catch (error) {
            processed++;
            errors++;
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error(`  ❌ Error processing sentence ${sentence.id}: ${errorMsg}`);
            return { id: sentence.id, error: errorMsg };
          }
        })
      );

      // Show progress
      const succeeded = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length;
      const skipped = results.filter(r => r.status === 'fulfilled' && (r.value as any).skipped).length;
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && (r.value as any).error)).length;

      console.log(`  ✓ Batch complete: ${succeeded} updated, ${skipped} skipped, ${failed} errors`);
      console.log(`  📈 Progress: ${processed}/${sentences.length} (${Math.round(processed / sentences.length * 100)}%)\n`);

      // Small delay between batches to be nice to the language processor
      if (i + BATCH_SIZE < sentences.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Final summary
    console.log('━'.repeat(60));
    console.log('✅ Backfill complete!\n');
    console.log(`📊 Statistics:`);
    console.log(`   Total processed: ${processed}`);
    console.log(`   Successfully updated: ${updated}`);
    console.log(`   Errors: ${errors}`);
    console.log(`   Success rate: ${Math.round(updated / processed * 100)}%\n`);

  } catch (error) {
    console.error('❌ Fatal error during backfill:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
backfillMetadata()
  .then(() => {
    console.log('🎉 Script finished successfully\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
