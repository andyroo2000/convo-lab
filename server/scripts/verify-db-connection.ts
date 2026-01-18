import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Load production environment - correct path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const prodEnvPath = path.join(__dirname, '../../', '.env.production');
console.log(`Loading .env.production from: ${prodEnvPath}`);
dotenv.config({ path: prodEnvPath, override: true });

const prisma = new PrismaClient();

async function verifyConnection() {
  try {
    console.log('🔍 Verifying database connection...\n');

    // Show what DATABASE_URL we're using (redact password)
    const dbUrl = process.env.DATABASE_URL || '';
    const redactedUrl = dbUrl.replace(/:[^:@]+@/, ':****@');
    console.log(`DATABASE_URL: ${redactedUrl}\n`);

    // Get total user count
    const totalUsers = await prisma.user.count();
    console.log(`Total users in database: ${totalUsers}`);

    // Get all users with their email
    const users = await prisma.user.findMany({
      select: {
        email: true,
        name: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log('\nAll users in this database:');
    users.forEach((user, idx) => {
      console.log(`  ${idx + 1}. ${user.email} (${user.name}) - ${user.createdAt.toISOString()}`);
    });

    // Try searching for partial matches
    console.log('\n🔍 Searching for "nemtsov" in email, name, or displayName...\n');

    const searchResults = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: 'nemtsov', mode: 'insensitive' } },
          { name: { contains: 'nemtsov', mode: 'insensitive' } },
          { displayName: { contains: 'nemtsov', mode: 'insensitive' } },
        ]
      },
      select: {
        email: true,
        name: true,
        displayName: true,
        createdAt: true,
      }
    });

    if (searchResults.length > 0) {
      console.log('Found matches:');
      searchResults.forEach(user => {
        console.log(`  - ${user.email} (${user.name || user.displayName})`);
      });
    } else {
      console.log('No matches found for "nemtsov"');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyConnection();
