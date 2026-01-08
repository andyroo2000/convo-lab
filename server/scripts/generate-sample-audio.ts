/**
 * Script to generate audio for sample dialogues
 *
 * Generates audio at all 3 speeds (0.7x, 0.85x, 1.0x) for the sample dialogues
 *
 * Usage: npx tsx scripts/generate-sample-audio.ts
 */

import { prisma } from '../src/db/client.js';
import { generateAllSpeedsAudio } from '../src/services/audioGenerator.js';

async function generateAudioForSample(episodeId: string, dialogueId: string, title: string): Promise<'success' | 'skipped' | 'failed'> {
  console.log(`\n🔊 Generating audio for "${title}"...`);

  try {
    await generateAllSpeedsAudio(episodeId, dialogueId, (progress) => {
      if (progress % 20 === 0) {
        console.log(`  Progress: ${progress}%`);
      }
    });

    console.log(`  ✅ Audio generated successfully for "${title}"`);
    return 'success';
  } catch (error) {
    console.error(`  ❌ Failed to generate audio for "${title}":`, error);
    return 'failed';
  }
}

async function main() {
  console.log('🚀 Starting audio generation for sample dialogues...\n');

  let successCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const failedEpisodes: string[] = [];

  try {
    // Get all sample episodes with dialogues
    const episodes = await prisma.episode.findMany({
      where: { isSampleContent: true },
      include: { dialogue: true },
      orderBy: { createdAt: 'asc' },
    });

    if (episodes.length === 0) {
      console.log('❌ No sample dialogues found. Run generate-sample-dialogues.ts first.');
      return;
    }

    console.log(`Found ${episodes.length} sample dialogues to process\n`);

    // Generate audio for each episode
    for (const episode of episodes) {
      if (!episode.dialogue) {
        console.log(`⚠️  Skipping "${episode.title}" - no dialogue found`);
        skippedCount++;
        continue;
      }

      // Skip if audio already exists
      if (episode.audioUrl_1_0) {
        console.log(`⏭️  Skipping "${episode.title}" - audio already exists`);
        skippedCount++;
        continue;
      }

      const result = await generateAudioForSample(episode.id, episode.dialogue.id, episode.title);

      if (result === 'success') {
        successCount++;
      } else if (result === 'failed') {
        failedCount++;
        failedEpisodes.push(episode.title);
      } else {
        skippedCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✨ Audio generation complete!');
    console.log(`📊 Generated: ${successCount} new audio files`);
    console.log(`⏭️  Skipped: ${skippedCount} (already have audio)`);
    console.log(`❌ Failed: ${failedCount}`);
    if (failedEpisodes.length > 0) {
      console.log('\nFailed episodes:');
      failedEpisodes.forEach(title => console.log(`  - ${title}`));
    }
    console.log('='.repeat(60));

    if (failedCount === 0) {
      console.log('\n📋 Next steps:');
      console.log('  1. Create onboarding logic to copy these to new users');
      console.log('  2. Update library UI to show sample content');
      console.log('  3. Test the complete user experience');
    }
  } catch (error) {
    console.error('\n❌ Unexpected error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
