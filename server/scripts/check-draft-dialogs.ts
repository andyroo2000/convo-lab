import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Load production environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../', '.env.production'), override: true });

const prisma = new PrismaClient();

async function checkDraftDialogs() {
  const email = 'nemtsov@gmail.com';

  try {
    console.log(`🔍 Checking draft dialogs for ${email}...\n`);

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true }
    });

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    // Get draft episodes
    const draftEpisodes = await prisma.episode.findMany({
      where: {
        userId: user.id,
        status: 'draft'
      },
      select: {
        id: true,
        title: true,
        status: true,
        sourceText: true,
        targetLanguage: true,
        nativeLanguage: true,
        createdAt: true,
        updatedAt: true,
        dialogue: {
          select: {
            id: true,
            sentences: {
              select: {
                id: true,
                text: true,
                translation: true,
                order: true,
              },
              orderBy: { order: 'asc' }
            },
            speakers: {
              select: {
                id: true,
                name: true,
                voiceId: true,
                proficiency: true,
              }
            }
          }
        },
        images: {
          select: {
            id: true,
            url: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`📝 Found ${draftEpisodes.length} draft episodes\n`);

    for (const episode of draftEpisodes) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📄 Episode: "${episode.title}"`);
      console.log(`   ID: ${episode.id}`);
      console.log(`   Status: ${episode.status}`);
      console.log(`   Created: ${episode.createdAt.toISOString()}`);
      console.log(`   Updated: ${episode.updatedAt.toISOString()}`);
      console.log(`   Target Language: ${episode.targetLanguage}`);
      console.log(`   Native Language: ${episode.nativeLanguage}`);

      if (episode.sourceText) {
        console.log(`   Source Text: ${episode.sourceText.substring(0, 100)}${episode.sourceText.length > 100 ? '...' : ''}`);
      }

      // Check dialogue data
      if (episode.dialogue) {
        console.log(`\n   ✅ Has Dialogue:`);
        console.log(`      - Speakers: ${episode.dialogue.speakers.length}`);
        episode.dialogue.speakers.forEach(speaker => {
          console.log(`        • ${speaker.name} (${speaker.proficiency}) - Voice: ${speaker.voiceId}`);
        });
        console.log(`      - Sentences: ${episode.dialogue.sentences.length}`);
        if (episode.dialogue.sentences.length > 0) {
          console.log(`      - First sentence: "${episode.dialogue.sentences[0].text}"`);
          console.log(`      - Last sentence: "${episode.dialogue.sentences[episode.dialogue.sentences.length - 1].text}"`);
        }
      } else {
        console.log(`\n   ❌ No dialogue data`);
      }

      // Check images
      if (episode.images.length > 0) {
        console.log(`\n   🖼️  Images: ${episode.images.length}`);
      } else {
        console.log(`\n   ❌ No images`);
      }

      console.log();
    }

    // Determine what needs to be done
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 Analysis:\n');

    for (const episode of draftEpisodes) {
      const hasDialogue = episode.dialogue && episode.dialogue.sentences.length > 0;
      const hasImages = episode.images.length > 0;

      console.log(`Episode: "${episode.title}"`);

      if (!hasDialogue) {
        console.log(`  ⚠️  Missing dialogue content - may need to regenerate`);
      } else if (!hasImages) {
        console.log(`  ⚠️  Has dialogue but no images - can generate images`);
      } else {
        console.log(`  ✅ Has both dialogue and images - can be marked as ready`);
      }
      console.log();
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDraftDialogs();
