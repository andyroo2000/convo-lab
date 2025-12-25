import { prisma } from '../src/db/client.js';
import { getAvatarUrlFromVoice, parseVoiceIdForGender } from '../src/services/avatarService.js';

/**
 * Backfill avatarUrl for existing speakers
 *
 * This script updates all existing speakers in the database with
 * the appropriate avatar URL based on their voiceId and tone.
 */
async function backfillSpeakerAvatars() {
  console.log('Starting speaker avatar backfill...\n');

  // Get all speakers (to update both gender and avatarUrl)
  const speakers = await prisma.speaker.findMany();

  console.log(`Found ${speakers.length} speakers without avatars\n`);

  let successCount = 0;
  let failureCount = 0;

  for (const speaker of speakers) {
    try {
      // Extract gender from voiceId
      const gender = parseVoiceIdForGender(speaker.voiceId);

      // Get the avatar URL based on voiceId and tone
      const avatarUrl = await getAvatarUrlFromVoice(speaker.voiceId, speaker.tone);

      if (avatarUrl) {
        // Update the speaker with both gender and avatar URL
        await prisma.speaker.update({
          where: { id: speaker.id },
          data: { gender, avatarUrl },
        });

        console.log(
          `✅ Updated speaker "${speaker.name}" (${speaker.voiceId}, ${gender}, ${speaker.tone})`
        );
        console.log(`   Avatar: ${avatarUrl.substring(0, 80)}...\n`);
        successCount++;
      } else {
        console.log(
          `⚠️  No matching avatar found for "${speaker.name}" (${speaker.voiceId}, ${gender}, ${speaker.tone})\n`
        );
        failureCount++;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log(`❌ Failed to update speaker "${speaker.name}": ${errorMessage}\n`);
      failureCount++;
    }
  }

  console.log('\n==== Backfill Summary ====\n');
  console.log(`Total speakers processed: ${speakers.length}`);
  console.log(`Successfully updated: ${successCount}`);
  console.log(`Failed or no match: ${failureCount}\n`);

  if (successCount === speakers.length) {
    console.log('🎉 All speakers updated successfully!');
  } else if (successCount > 0) {
    console.log('⚠️  Backfill completed with some failures or missing avatars.');
  } else {
    console.log('❌ Backfill failed - no speakers were updated.');
  }
}

// Run the backfill
backfillSpeakerAvatars()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error('Backfill failed:', error);
    prisma.$disconnect();
    process.exit(1);
  });
