import { prisma } from '../src/db/client.js';

/**
 * Diagnostic script to check if audio URLs at different speeds are properly generated
 * Usage: npx tsx server/scripts/check-audio-speeds.ts [episodeId]
 */

async function checkAudioSpeeds(episodeId?: string) {
  try {
    let episode;

    if (episodeId) {
      episode = await prisma.episode.findUnique({
        where: { id: episodeId },
      });
    } else {
      // Get the most recent episode with all speed URLs
      episode = await prisma.episode.findFirst({
        where: {
          AND: [
            { audioUrl_0_7: { not: null } },
            { audioUrl_0_85: { not: null } },
            { audioUrl_1_0: { not: null } },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!episode) {
      console.log('❌ No episode found with all speed URLs');
      return;
    }

    console.log('\n=== Episode Audio Speed Check ===');
    console.log(`Episode ID: ${episode.id}`);
    console.log(`Title: ${episode.title}`);
    console.log(`Created: ${episode.createdAt}`);
    console.log('\n--- Audio URLs ---');
    console.log(`Slow (0.7x):   ${episode.audioUrl_0_7 || 'NOT SET'}`);
    console.log(`Medium (0.85x): ${episode.audioUrl_0_85 || 'NOT SET'}`);
    console.log(`Normal (1.0x):  ${episode.audioUrl_1_0 || 'NOT SET'}`);

    // Check if URLs are different
    const urls = [episode.audioUrl_0_7, episode.audioUrl_0_85, episode.audioUrl_1_0].filter(
      Boolean
    );
    const uniqueUrls = new Set(urls);

    console.log('\n--- URL Analysis ---');
    console.log(`Total URLs: ${urls.length}`);
    console.log(`Unique URLs: ${uniqueUrls.size}`);

    if (uniqueUrls.size === 1) {
      console.log('⚠️  WARNING: All URLs are the same! This is the problem.');
    } else if (uniqueUrls.size === 3) {
      console.log('✅ All URLs are different (expected)');
    } else {
      console.log('⚠️  Some URLs are duplicates');
    }

    // Check sentence timings
    const dialogue = await prisma.dialogue.findFirst({
      where: { episodeId: episode.id },
      include: {
        sentences: {
          orderBy: { order: 'asc' },
          take: 3, // Just check first 3 sentences
        },
      },
    });

    if (dialogue && dialogue.sentences.length > 0) {
      console.log('\n--- Sentence Timings (First 3 sentences) ---');
      dialogue.sentences.forEach((sentence, idx) => {
        console.log(`\nSentence ${idx + 1}: "${sentence.text.substring(0, 50)}..."`);
        console.log(`  Slow (0.7x):   ${sentence.startTime_0_7}ms - ${sentence.endTime_0_7}ms`);
        console.log(`  Medium (0.85x): ${sentence.startTime_0_85}ms - ${sentence.endTime_0_85}ms`);
        console.log(`  Normal (1.0x):  ${sentence.startTime_1_0}ms - ${sentence.endTime_1_0}ms`);

        // Check if timings are different
        const timings = [
          sentence.endTime_0_7 - sentence.startTime_0_7,
          sentence.endTime_0_85 - sentence.startTime_0_85,
          sentence.endTime_1_0 - sentence.startTime_1_0,
        ];

        if (timings[0] === timings[1] && timings[1] === timings[2]) {
          console.log('  ⚠️  All durations are identical - speeds might not be working!');
        } else {
          console.log(`  ✅ Durations: ${timings[0]}ms, ${timings[1]}ms, ${timings[2]}ms`);
        }
      });
    }

    console.log('\n');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

const episodeId = process.argv[2];
checkAudioSpeeds(episodeId);
