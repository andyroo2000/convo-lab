import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Load production environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../..', '.env.production') });

const prisma = new PrismaClient();

async function listAllUsers() {
  try {
    console.log('🔍 Fetching all users from production database...\n');

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        displayName: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            episodes: true,
            courses: true,
            generationLogs: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`📊 Total users: ${users.length}\n`);

    // Filter out system user
    const realUsers = users.filter(u => u.email !== 'system@languageflow.app');

    console.log(`👥 Non-system users: ${realUsers.length}\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    realUsers.forEach((user, idx) => {
      console.log(`${idx + 1}. ${user.email}`);
      console.log(`   Name: ${user.name || 'None'}`);
      if (user.displayName && user.displayName !== user.name) {
        console.log(`   Display Name: ${user.displayName}`);
      }
      console.log(`   Role: ${user.role}`);
      console.log(`   Created: ${user.createdAt.toISOString()}`);
      console.log(`   Content: ${user._count.episodes} dialogs, ${user._count.courses} courses`);
      console.log(`   Generation logs: ${user._count.generationLogs}`);
      console.log();
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listAllUsers();
