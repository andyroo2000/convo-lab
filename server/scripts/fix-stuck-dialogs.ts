import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Load production environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../', '.env.production'), override: true });

const prisma = new PrismaClient();

const episodeIds = [
  'b6e14eb1-25bd-449c-a6c2-317bc223c88f', // "Generating dialogue..."
  '92d36994-1567-4602-8815-3e68fb21c98c', // "Conversation with flight attendants..."
];

async function fixStuckDialogs() {
  try {
    console.log('🔍 Analyzing stuck dialogs...\n');

    for (const episodeId of episodeIds) {
      const episode = await prisma.episode.findUnique({
        where: { id: episodeId },
        select: {
          id: true,
          title: true,
          sourceText: true,
          createdAt: true,
          updatedAt: true,
          dialogue: {
            select: {
              id: true,
              sentences: { select: { id: true } },
              speakers: { select: { id: true } }
            }
          }
        }
      });

      if (!episode) {
        console.log(`❌ Episode ${episodeId} not found`);
        continue;
      }

      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📄 "${episode.title}"`);
      console.log(`   ID: ${episode.id}`);
      console.log(`   Source: ${episode.sourceText}`);
      console.log(`   Created: ${episode.createdAt.toISOString()}`);
      console.log(`   Updated: ${episode.updatedAt.toISOString()}`);

      const hasDialogue = episode.dialogue && episode.dialogue.sentences.length > 0;
      console.log(`   Has Content: ${hasDialogue ? 'YES' : 'NO'}`);

      if (!hasDialogue) {
        const ageInHours = (Date.now() - episode.createdAt.getTime()) / (1000 * 60 * 60);
        console.log(`   Age: ${ageInHours.toFixed(1)} hours`);

        // If it's been more than 1 hour and still no content, it's stuck
        if (ageInHours > 1) {
          console.log(`   ⚠️  STUCK - No content generated after ${ageInHours.toFixed(1)} hours`);
          console.log(`   Recommendation: Delete this episode`);
        } else {
          console.log(`   ⏳ May still be processing...`);
        }
      }

      console.log();
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 Action Plan:\n');
    console.log('Since these dialogs have been stuck for hours with no content,');
    console.log('the best course of action is to:');
    console.log('  1. Delete these stuck episodes');
    console.log('  2. User can recreate them if needed');
    console.log('\nWould you like me to delete them? (You\'ll need to confirm)');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixStuckDialogs();
