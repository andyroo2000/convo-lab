/**
 * Fix voice provider mismatches
 *
 * Some speakers have Polly voice IDs (like "Takumi", "Kazuha") but voiceProvider set to "google".
 * This causes TTS synthesis to fail. This script fixes the mismatch by setting voiceProvider to "polly"
 * for any voice IDs that don't contain a hyphen (Google voices always have hyphens like "ja-JP-Neural2-B").
 */

import { prisma } from '../src/db/client.js';

async function main() {
  console.log('🔍 Finding speakers with mismatched voice providers...\n');

  // Find speakers with non-hyphenated voice IDs (Polly) but voiceProvider="google"
  const mismatchedSpeakers = await prisma.speaker.findMany({
    where: {
      voiceProvider: 'google',
      NOT: {
        voiceId: {
          contains: '-',
        },
      },
    },
    select: {
      id: true,
      name: true,
      voiceId: true,
      voiceProvider: true,
      dialogue: {
        select: {
          episode: {
            select: {
              title: true,
              targetLanguage: true,
            },
          },
        },
      },
    },
  });

  console.log(`Found ${mismatchedSpeakers.length} speakers with mismatched providers:\n`);

  if (mismatchedSpeakers.length === 0) {
    console.log('✅ No mismatches found! All voice providers are correct.');
    await prisma.$disconnect();
    return;
  }

  // Display what we found
  mismatchedSpeakers.forEach((speaker, idx) => {
    console.log(`${idx + 1}. ${speaker.name}`);
    console.log(`   Voice ID: ${speaker.voiceId} (Polly voice)`);
    console.log(`   Current Provider: ${speaker.voiceProvider} ❌ (should be "polly")`);
    console.log(`   Episode: ${speaker.dialogue?.episode?.title} (${speaker.dialogue?.episode?.targetLanguage})`);
    console.log('');
  });

  console.log('🔧 Fixing voice providers...\n');

  // Update all mismatched speakers to use "polly" provider
  const result = await prisma.speaker.updateMany({
    where: {
      voiceProvider: 'google',
      NOT: {
        voiceId: {
          contains: '-',
        },
      },
    },
    data: {
      voiceProvider: 'polly',
    },
  });

  console.log(`✅ Updated ${result.count} speakers to use "polly" provider\n`);

  // Verify the fix
  const remainingMismatches = await prisma.speaker.findMany({
    where: {
      voiceProvider: 'google',
      NOT: {
        voiceId: {
          contains: '-',
        },
      },
    },
  });

  if (remainingMismatches.length === 0) {
    console.log('✅ All voice provider mismatches have been fixed!');
  } else {
    console.log(`⚠️  Warning: ${remainingMismatches.length} mismatches still remain`);
  }

  await prisma.$disconnect();
}

main();
