/**
 * Script to generate pre-made sample dialogues for new users
 *
 * Generates 3 Japanese N5 dialogues:
 * 1. Meeting Someone New
 * 2. At a Café/Restaurant
 * 3. Making Weekend Plans
 *
 * Usage: npx tsx scripts/generate-sample-dialogues.ts
 */

import { prisma } from '../src/db/client.js';
import { generateDialogue } from '../src/services/dialogueGenerator.js';
import { getDialogueSpeakerVoices } from '@languageflow/shared/src/voiceSelection';
import { getRandomName } from '@languageflow/shared/src/nameConstants';

// Sample dialogue topics and prompts
const SAMPLE_DIALOGUES = [
  {
    title: 'Meeting Someone New',
    sourceText: `Two people meet for the first time at a coffee shop in Tokyo. They introduce themselves, ask about each other's background, and exchange basic information like where they're from and what they do. The conversation is friendly and polite, using appropriate introductory phrases in Japanese.`,
    targetLanguage: 'ja' as const,
    nativeLanguage: 'en' as const,
    proficiency: 'N5',
    tone: 'polite' as const,
    dialogueLength: 8,
  },
  {
    title: 'At a Café',
    sourceText: `A customer enters a café in Japan and orders a drink and a light snack. They ask the staff about menu recommendations, place their order, and ask about payment. The conversation includes typical café interactions like asking about sizes, toppings, and whether to dine in or take out.`,
    targetLanguage: 'ja' as const,
    nativeLanguage: 'en' as const,
    proficiency: 'N5',
    tone: 'polite' as const,
    dialogueLength: 8,
  },
  {
    title: 'Making Weekend Plans',
    sourceText: `Two friends discuss their weekend plans. They talk about what they want to do, suggest activities like going to the movies or shopping, and decide on a time and place to meet. The conversation is casual and uses everyday Japanese expressions for making plans with friends.`,
    targetLanguage: 'ja' as const,
    nativeLanguage: 'en' as const,
    proficiency: 'N5',
    tone: 'casual' as const,
    dialogueLength: 8,
  },
];

async function findOrCreateSystemUser() {
  // Try to find an admin user to own the sample content
  let systemUser = await prisma.user.findFirst({
    where: { role: 'admin' },
  });

  if (!systemUser) {
    // Create a dedicated system user if no admin exists
    console.log('No admin user found, creating system user for sample content...');
    systemUser = await prisma.user.create({
      data: {
        email: 'system@convo-lab.com',
        password: '', // No password - system user can't log in
        name: 'System',
        role: 'admin',
        tier: 'pro',
        onboardingCompleted: true,
        preferredStudyLanguage: 'ja',
        preferredNativeLanguage: 'en',
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });
    console.log(`✓ Created system user: ${systemUser.id}`);
  } else {
    console.log(`✓ Using existing admin user: ${systemUser.id}`);
  }

  return systemUser;
}

async function generateSampleDialogue(
  systemUserId: string,
  dialogueConfig: typeof SAMPLE_DIALOGUES[0]
) {
  console.log(`\n📝 Generating: "${dialogueConfig.title}"...`);

  // 1. Create episode
  const episode = await prisma.episode.create({
    data: {
      userId: systemUserId,
      title: dialogueConfig.title,
      sourceText: dialogueConfig.sourceText,
      targetLanguage: dialogueConfig.targetLanguage,
      nativeLanguage: dialogueConfig.nativeLanguage,
      status: 'generating',
      isSampleContent: true,
    },
  });

  console.log(`  ✓ Created episode: ${episode.id}`);

  // 2. Get appropriate voices for the dialogue
  const voiceInfo = getDialogueSpeakerVoices(dialogueConfig.targetLanguage, 2);
  const speakers = voiceInfo.map((v, index) => ({
    id: `speaker-${index + 1}`,
    name: getRandomName(dialogueConfig.targetLanguage, v.gender),
    voiceId: v.voiceId,
    proficiency: dialogueConfig.proficiency,
    tone: dialogueConfig.tone,
    color: index === 0 ? '#6366f1' : '#ec4899',
  }));

  console.log(`  ✓ Selected voices: ${speakers.map((s) => s.name).join(', ')}`);

  // 3. Generate dialogue
  console.log('  ⏳ Generating dialogue content...');
  await generateDialogue({
    episodeId: episode.id,
    speakers,
    variationCount: 3,
    dialogueLength: dialogueConfig.dialogueLength,
  });

  // 4. Update episode status
  await prisma.episode.update({
    where: { id: episode.id },
    data: { status: 'ready' },
  });

  console.log(`  ✅ Generated "${dialogueConfig.title}" successfully!`);

  return episode.id;
}

async function main() {
  console.log('🚀 Starting sample dialogue generation...\n');

  try {
    // Find or create system user
    const systemUser = await findOrCreateSystemUser();

    // Generate all sample dialogues
    const episodeIds: string[] = [];
    for (const dialogueConfig of SAMPLE_DIALOGUES) {
      const episodeId = await generateSampleDialogue(systemUser.id, dialogueConfig);
      episodeIds.push(episodeId);
    }

    console.log('\n✨ All sample dialogues generated successfully!');
    console.log(`\nGenerated episode IDs:`);
    episodeIds.forEach((id, index) => {
      console.log(`  ${index + 1}. ${SAMPLE_DIALOGUES[index].title}: ${id}`);
    });

    console.log('\n📋 Next steps:');
    console.log('  1. Test the dialogues in the app');
    console.log('  2. Generate audio for each dialogue');
    console.log('  3. Create onboarding logic to copy these to new user libraries');
  } catch (error) {
    console.error('\n❌ Error generating sample dialogues:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
