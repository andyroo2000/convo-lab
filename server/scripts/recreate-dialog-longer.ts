import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Load production environment FIRST before importing anything else
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../', '.env.production'), override: true });

// Import after env is loaded
const { PrismaClient } = await import('@prisma/client');
const { generateDialogue } = await import('../src/services/dialogueGenerator.js');

const prisma = new PrismaClient();

const episodeIdToDelete = '6907b53c-dc8a-4ce8-a354-63216e1924e2';

async function recreateDialogLonger() {
  try {
    console.log('🗑️  Deleting previous dialogue...\n');

    // Delete the old episode
    await prisma.episode.delete({
      where: { id: episodeIdToDelete }
    });

    console.log('✅ Previous dialogue deleted\n');

    console.log('🔍 Finding Yuriy...\n');

    const user = await prisma.user.findUnique({
      where: { email: 'nemtsov@gmail.com' },
      select: {
        id: true,
        email: true,
        name: true,
        preferredStudyLanguage: true,
        preferredNativeLanguage: true,
        proficiencyLevel: true,
      }
    });

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log(`✅ Found user: ${user.email} (${user.name})\n`);

    // Create the episode
    console.log('📝 Creating new episode with 30 turns...\n');

    const episode = await prisma.episode.create({
      data: {
        userId: user.id,
        title: 'Conversation with flight attendants on the way to France',
        sourceText: 'Casual conversations with flight attendants on the way to France',
        targetLanguage: user.preferredStudyLanguage,
        nativeLanguage: user.preferredNativeLanguage,
        audioSpeed: 'medium',
        status: 'draft',
      },
    });

    console.log(`✅ Episode created: ${episode.id}`);
    console.log(`   Title: "${episode.title}"\n`);

    // Define speakers for A1 French dialogue
    const speakers = [
      {
        name: 'Flight Attendant',
        voiceId: 'fr-FR-Neural2-A', // Female French voice
        voiceProvider: 'google',
        proficiency: 'intermediate',
        tone: 'polite',
        gender: 'female',
      },
      {
        name: 'You',
        voiceId: 'fr-FR-Neural2-D', // Male French voice
        voiceProvider: 'google',
        proficiency: 'beginner',
        tone: 'casual',
        gender: 'male',
      }
    ];

    console.log('🎭 Speakers configured:');
    speakers.forEach(s => {
      console.log(`   - ${s.name} (${s.proficiency}, ${s.tone}) - Voice: ${s.voiceId}`);
    });
    console.log();

    // Generate the dialogue using the service with 30 turns
    console.log('🤖 Generating dialogue with AI (30 turns)...\n');
    console.log('⏳ This may take 60-90 seconds...\n');

    const dialogue = await generateDialogue({
      episodeId: episode.id,
      speakers: speakers as any,
      variationCount: 3,
      dialogueLength: 30, // 30 turns instead of 8
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Dialogue generated successfully!\n');
    console.log(`Episode ID: ${episode.id}`);
    console.log(`Dialogue ID: ${dialogue.dialogue.id}`);
    console.log(`Speakers: ${dialogue.speakers.length}`);
    console.log(`Sentences: ${dialogue.sentences.length}`);
    console.log();

    // Log the generation for quota tracking
    await prisma.generationLog.create({
      data: {
        userId: user.id,
        contentType: 'dialogue',
        contentId: episode.id,
      }
    });

    console.log('✅ Generation logged for quota tracking\n');

    // Reload and display the episode
    const updatedEpisode = await prisma.episode.findUnique({
      where: { id: episode.id },
      select: {
        id: true,
        title: true,
        status: true,
        dialogue: {
          select: {
            sentences: {
              select: {
                text: true,
                translation: true,
                speaker: {
                  select: {
                    name: true,
                  }
                }
              },
              orderBy: { order: 'asc' },
              take: 5, // Show first 5 sentences as preview
            }
          }
        }
      }
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📄 Preview of dialogue (first 5 turns):\n');
    updatedEpisode?.dialogue?.sentences.forEach((sent, idx) => {
      console.log(`${idx + 1}. ${sent.speaker.name}: ${sent.text}`);
      console.log(`   "${sent.translation}"\n`);
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Complete! Yuriy can now view this dialogue at:');
    console.log(`   https://convo-lab.com/app/playback/${episode.id}`);
    console.log(`\n   Total turns: 30`);

  } catch (error) {
    console.error('❌ Error:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack:', error.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

recreateDialogLonger();
