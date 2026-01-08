/**
 * Script to generate ALL sample dialogues for all language/level combinations
 *
 * Generates 3 dialogues per language/level combination:
 * 1. Meeting Someone New
 * 2. At a Café/Restaurant
 * 3. Making Weekend Plans
 *
 * Languages & Levels:
 * - Japanese: N5, N4, N3, N2, N1 (15 dialogues)
 * - Chinese: HSK1, HSK2, HSK3, HSK4, HSK5, HSK6 (18 dialogues)
 * - Spanish: A1, A2, B1, B2, C1, C2 (18 dialogues)
 * - French: A1, A2, B1, B2, C1, C2 (18 dialogues)
 * - Arabic: A1, A2, B1, B2, C1, C2 (18 dialogues)
 *
 * Total: 87 dialogues
 *
 * Usage: npx tsx scripts/generate-all-sample-dialogues.ts [language] [level]
 * Examples:
 *   npx tsx scripts/generate-all-sample-dialogues.ts          # Generate all
 *   npx tsx scripts/generate-all-sample-dialogues.ts ja       # All Japanese levels
 *   npx tsx scripts/generate-all-sample-dialogues.ts ja N4   # Just Japanese N4
 */

import { prisma } from '../src/db/client.js';
import { generateDialogue } from '../src/services/dialogueGenerator.js';
import { getDialogueSpeakerVoices } from '@languageflow/shared/src/voiceSelection';
import { getRandomName } from '@languageflow/shared/src/nameConstants';

type LanguageCode = 'ja' | 'zh' | 'es' | 'fr' | 'ar';
type ToneStyle = 'casual' | 'polite' | 'formal';

interface DialogueTemplate {
  title: string;
  tone: ToneStyle;
  getSourceText: (language: LanguageCode, level: string) => string;
}

// Language-specific level configurations
const LANGUAGE_LEVELS = {
  ja: ['N5', 'N4', 'N3', 'N2', 'N1'],
  zh: ['HSK1', 'HSK2', 'HSK3', 'HSK4', 'HSK5', 'HSK6'],
  es: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
  fr: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
  ar: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
};

const LANGUAGE_NAMES = {
  ja: 'Japanese',
  zh: 'Chinese',
  es: 'Spanish',
  fr: 'French',
  ar: 'Arabic',
};

// Location names for cultural adaptation
const LOCATIONS = {
  ja: 'Tokyo',
  zh: 'Beijing',
  es: 'Madrid',
  fr: 'Paris',
  ar: 'Cairo',
};

// Get appropriate dialogue length for level (beginner = shorter, advanced = longer)
function getDialogueLength(level: string): number {
  // Beginner levels (N5, HSK1, A1)
  if (level === 'N5' || level === 'HSK1' || level === 'A1') return 8;
  // Elementary levels (N4, HSK2, A2)
  if (level === 'N4' || level === 'HSK2' || level === 'A2') return 10;
  // Intermediate levels (N3, HSK3-4, B1-B2)
  if (level === 'N3' || level.startsWith('HSK3') || level.startsWith('HSK4') || level === 'B1' || level === 'B2') return 12;
  // Advanced levels (N2-N1, HSK5-6, C1-C2)
  return 14;
}

// Get complexity descriptor for the level
function getLevelComplexity(level: string): string {
  if (level === 'N5' || level === 'HSK1' || level === 'A1') return 'very simple, basic';
  if (level === 'N4' || level === 'HSK2' || level === 'A2') return 'simple, elementary';
  if (level === 'N3' || level.startsWith('HSK3') || level.startsWith('HSK4') || level === 'B1' || level === 'B2') return 'intermediate, moderately complex';
  return 'advanced, sophisticated';
}

// Dialogue templates
const DIALOGUE_TEMPLATES: DialogueTemplate[] = [
  {
    title: 'Meeting Someone New',
    tone: 'polite',
    getSourceText: (lang: LanguageCode, level: string) => {
      const location = LOCATIONS[lang];
      const complexity = getLevelComplexity(level);
      return `Two people meet for the first time at a coffee shop in ${location}. They introduce themselves, ask about each other's background, and exchange information. The conversation should be ${complexity}, friendly and polite, using appropriate introductory phrases and level-appropriate vocabulary and grammar.`;
    },
  },
  {
    title: 'At a Café',
    tone: 'polite',
    getSourceText: (lang: LanguageCode, level: string) => {
      const location = LOCATIONS[lang];
      const complexity = getLevelComplexity(level);
      return `A customer enters a café in ${location} and orders food and drinks. The conversation should be ${complexity} and include typical café interactions appropriate for the proficiency level, using level-appropriate vocabulary and grammatical structures.`;
    },
  },
  {
    title: 'Making Weekend Plans',
    tone: 'casual',
    getSourceText: (lang: LanguageCode, level: string) => {
      const complexity = getLevelComplexity(level);
      return `Two friends discuss their weekend plans. They talk about activities, suggest ideas, and decide on plans. The conversation should be ${complexity}, casual and friendly, using everyday expressions appropriate for the proficiency level.`;
    },
  },
];

async function findOrCreateSystemUser() {
  let systemUser = await prisma.user.findFirst({
    where: { role: 'admin' },
  });

  if (!systemUser) {
    console.log('Creating system user for sample content...');
    systemUser = await prisma.user.create({
      data: {
        email: 'system@convo-lab.com',
        password: '',
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
  language: LanguageCode,
  level: string,
  template: DialogueTemplate
) {
  const fullTitle = `${template.title} (${LANGUAGE_NAMES[language]} ${level})`;
  console.log(`\n📝 Generating: "${fullTitle}"...`);

  // Check if this dialogue already exists
  const existing = await prisma.episode.findFirst({
    where: {
      title: template.title,
      targetLanguage: language,
      isSampleContent: true,
      dialogue: {
        speakers: {
          some: {
            proficiency: level,
          },
        },
      },
    },
  });

  if (existing) {
    console.log(`  ⏭️  Already exists, skipping`);
    return existing.id;
  }

  // Create episode
  const episode = await prisma.episode.create({
    data: {
      userId: systemUserId,
      title: template.title,
      sourceText: template.getSourceText(language, level),
      targetLanguage: language,
      nativeLanguage: 'en',
      status: 'generating',
      isSampleContent: true,
    },
  });

  console.log(`  ✓ Created episode: ${episode.id}`);

  // Get voices
  const voiceInfo = getDialogueSpeakerVoices(language, 2);
  const speakers = voiceInfo.map((v, index) => ({
    id: `speaker-${index + 1}`,
    name: getRandomName(language, v.gender),
    voiceId: v.voiceId,
    proficiency: level,
    tone: template.tone,
    color: index === 0 ? '#6366f1' : '#ec4899',
  }));

  console.log(`  ✓ Selected voices: ${speakers.map((s) => s.name).join(', ')}`);

  // Generate dialogue
  console.log('  ⏳ Generating dialogue content...');
  await generateDialogue({
    episodeId: episode.id,
    speakers,
    variationCount: 3,
    dialogueLength: getDialogueLength(level),
  });

  // Update status
  await prisma.episode.update({
    where: { id: episode.id },
    data: { status: 'ready' },
  });

  console.log(`  ✅ Generated successfully!`);
  return episode.id;
}

async function main() {
  const args = process.argv.slice(2);
  const targetLanguage = args[0] as LanguageCode | undefined;
  const targetLevel = args[1];

  console.log('🚀 Starting sample dialogue generation...\n');

  if (targetLanguage && !LANGUAGE_LEVELS[targetLanguage]) {
    console.error(`❌ Invalid language: ${targetLanguage}`);
    console.log(`Valid languages: ${Object.keys(LANGUAGE_LEVELS).join(', ')}`);
    process.exit(1);
  }

  try {
    const systemUser = await findOrCreateSystemUser();

    const languages = targetLanguage ? [targetLanguage] : Object.keys(LANGUAGE_LEVELS) as LanguageCode[];
    let totalGenerated = 0;
    let totalSkipped = 0;

    for (const lang of languages) {
      const levels = targetLevel ? [targetLevel] : LANGUAGE_LEVELS[lang];

      console.log(`\n${'='.repeat(60)}`);
      console.log(`📚 ${LANGUAGE_NAMES[lang]} (${levels.length} levels)`);
      console.log('='.repeat(60));

      for (const level of levels) {
        for (const template of DIALOGUE_TEMPLATES) {
          try {
            const episodeId = await generateSampleDialogue(systemUser.id, lang, level, template);
            if (episodeId) {
              const existing = await prisma.episode.findUnique({ where: { id: episodeId } });
              if (existing && existing.createdAt < new Date(Date.now() - 5000)) {
                totalSkipped++;
              } else {
                totalGenerated++;
              }
            }
          } catch (error) {
            console.error(`  ❌ Error generating "${template.title}" for ${lang} ${level}:`, error);
          }
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✨ Sample dialogue generation complete!');
    console.log(`📊 Generated: ${totalGenerated} new dialogues`);
    console.log(`⏭️  Skipped: ${totalSkipped} existing dialogues`);
    console.log('='.repeat(60));

    console.log('\n📋 Next steps:');
    console.log('  1. Run: npx tsx scripts/generate-sample-audio.ts');
    console.log('  2. Test in app: npm run dev');

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
