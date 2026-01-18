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

async function deleteStuckEpisodes() {
  try {
    console.log('🗑️  Deleting stuck episodes...\n');

    for (const episodeId of episodeIds) {
      const episode = await prisma.episode.findUnique({
        where: { id: episodeId },
        select: {
          id: true,
          title: true,
          sourceText: true,
        }
      });

      if (!episode) {
        console.log(`⚠️  Episode ${episodeId} not found (may already be deleted)`);
        continue;
      }

      console.log(`Deleting: "${episode.title}"`);
      console.log(`  ID: ${episode.id}`);
      console.log(`  Source: ${episode.sourceText}`);

      // Delete the episode (cascade will handle related records)
      await prisma.episode.delete({
        where: { id: episodeId }
      });

      console.log(`  ✅ Deleted\n`);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Cleanup complete!');
    console.log('\nYuriy can now recreate these dialogs if needed.');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteStuckEpisodes();
