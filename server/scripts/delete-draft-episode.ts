import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Load production environment FIRST before importing prisma
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../', '.env.production'), override: true });

// Import prisma AFTER env is loaded
const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

const episodeId = 'ab187492-32f5-4639-b056-2ba0fdcc0fb7';

async function deleteDraftEpisode() {
  try {
    console.log('🗑️  Deleting draft episode that can\'t be accessed from UI...\n');

    const episode = await prisma.episode.findUnique({
      where: { id: episodeId },
      select: {
        id: true,
        title: true,
        status: true,
        user: {
          select: {
            email: true,
          }
        }
      }
    });

    if (!episode) {
      console.log('❌ Episode not found');
      return;
    }

    console.log(`Deleting episode: "${episode.title}"`);
    console.log(`  User: ${episode.user.email}`);
    console.log(`  Status: ${episode.status}`);
    console.log(`  ID: ${episode.id}`);

    await prisma.episode.delete({
      where: { id: episodeId }
    });

    console.log('\n✅ Episode deleted successfully!');
    console.log('\nNote: Yuriy already has the audio course with the same name');
    console.log('which is working perfectly. The draft dialog would have been');
    console.log('inaccessible from the UI anyway since it had no dialogue data.');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteDraftEpisode();
