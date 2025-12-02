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
const { processLanguageTextBatch } = await import(`${basePath}/services/languageProcessor.js`);

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
  console.log('🔍 Finding sentences with empty or incomplete metadata...\n');

  try {
    // Find all sentences - we'll filter incomplete ones in memory
    // (Prisma doesn't support deep JSON queries well)
    const allSentences = await prisma.sentence.findMany({
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

    // Filter to sentences that need metadata processing
    const sentences = allSentences.filter(s => {
      const lang = s.dialogue.episode.targetLanguage;

      // For non-Japanese/Chinese languages, skip
      if (lang !== 'ja' && lang !== 'zh') {
        return false;
      }

      // No metadata at all
      if (!s.metadata || Object.keys(s.metadata).length === 0) {
        return true;
      }

      // Check for Japanese sentences with missing or empty furigana
      if (lang === 'ja') {
        const japanese = s.metadata?.japanese;
        if (!japanese || !japanese.furigana || japanese.furigana === s.text) {
          return true;
        }
      }

      // Check for Chinese sentences with missing or empty pinyin
      if (lang === 'zh') {
        const chinese = s.metadata?.chinese;
        if (!chinese || !chinese.pinyinToneMarks || chinese.pinyinToneMarks === '') {
          return true;
        }
      }

      return false;
    });

    if (sentences.length === 0) {
      console.log('✅ No sentences found with empty metadata. All done!\n');
      return;
    }

    console.log(`📊 Found ${sentences.length} sentences to process\n`);

    // Process in batches, using batch language processing
    const BATCH_SIZE = 50; // Increased since we're batching API calls
    let processed = 0;
    let updated = 0;
    let errors = 0;

    for (let i = 0; i < sentences.length; i += BATCH_SIZE) {
      const batch = sentences.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(sentences.length / BATCH_SIZE);

      console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} sentences)...`);

      try {
        // Group sentences by target language
        const byLanguage = new Map<string, Array<{ index: number; sentence: SentenceWithEpisode }>>();

        batch.forEach((sentence, idx) => {
          const lang = sentence.dialogue.episode.targetLanguage;
          if (!byLanguage.has(lang)) {
            byLanguage.set(lang, []);
          }
          byLanguage.get(lang)!.push({ index: idx, sentence });
        });

        // Process each language group with a single batch call
        const metadataResults = new Map<number, any>();

        for (const [lang, items] of byLanguage) {
          // Skip languages that don't need processing
          if (lang !== 'ja' && lang !== 'zh') {
            items.forEach(item => {
              metadataResults.set(item.index, null); // null = skip
            });
            continue;
          }

          // Batch process all texts for this language
          const texts = items.map(item => item.sentence.text);
          console.log(`  [BATCH] Processing ${texts.length} ${lang} sentences in 1 call`);

          const results = await processLanguageTextBatch(texts, lang);

          items.forEach((item, idx) => {
            metadataResults.set(item.index, results[idx]);
          });
        }

        // Update database with results
        let batchUpdated = 0;
        let batchSkipped = 0;

        for (let idx = 0; idx < batch.length; idx++) {
          const sentence = batch[idx];
          const metadata = metadataResults.get(idx);

          if (metadata === null) {
            // Skipped language
            batchSkipped++;
            processed++;
            continue;
          }

          try {
            await prisma.sentence.update({
              where: { id: sentence.id },
              data: { metadata: metadata as any },
            });
            batchUpdated++;
            updated++;
            processed++;
          } catch (error) {
            errors++;
            processed++;
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error(`  ❌ Error updating sentence ${sentence.id}: ${errorMsg}`);
          }
        }

        console.log(`  ✓ Batch complete: ${batchUpdated} updated, ${batchSkipped} skipped, ${batch.length - batchUpdated - batchSkipped} errors`);
        console.log(`  📈 Progress: ${processed}/${sentences.length} (${Math.round(processed / sentences.length * 100)}%)\n`);

      } catch (error) {
        // If entire batch fails, mark all as errors
        batch.forEach(() => {
          errors++;
          processed++;
        });
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`  ❌ Batch failed: ${errorMsg}`);
        console.log(`  📈 Progress: ${processed}/${sentences.length} (${Math.round(processed / sentences.length * 100)}%)\n`);
      }

      // Small delay between batches
      if (i + BATCH_SIZE < sentences.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
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
