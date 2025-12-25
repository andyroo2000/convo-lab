/**
 * Seed script to create or update the demo user
 *
 * Usage:
 *   npx tsx scripts/seed-demo-user.ts
 *
 * This creates a demo user with the following credentials:
 *   Email: demo.user@test.com
 *   Password: convo-demo-2025
 *
 * Demo users can:
 *   - Log in and navigate the app
 *   - View all content created by the admin user
 *   - Access create/generate pages (but cannot submit forms)
 *
 * Demo users cannot:
 *   - Generate or create any new content
 *   - Delete any content
 */

import bcrypt from 'bcrypt';

// In production, import from dist; in dev, import from src
const isProd = process.env.NODE_ENV === 'production';
const basePath = isProd ? '../dist/server/src' : '../src';

const { prisma } = await import(`${basePath}/db/client.js`);

const DEMO_USER_EMAIL = 'demo.user@test.com';
const DEMO_USER_PASSWORD = 'convo-demo-2025';
const DEMO_USER_NAME = 'Demo User';

async function seedDemoUser() {
  console.log('🌱 Seeding demo user...\n');

  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(DEMO_USER_PASSWORD, 10);

    // Upsert the demo user (create if not exists, update if exists)
    const demoUser = await prisma.user.upsert({
      where: { email: DEMO_USER_EMAIL },
      update: {
        role: 'demo',
        password: hashedPassword,
      },
      create: {
        email: DEMO_USER_EMAIL,
        password: hashedPassword,
        name: DEMO_USER_NAME,
        role: 'demo',
        onboardingCompleted: true,
        preferredStudyLanguage: 'ja',
        preferredNativeLanguage: 'en',
      },
    });

    console.log('✅ Demo user created/updated successfully!');
    console.log('');
    console.log('   Email:    ' + DEMO_USER_EMAIL);
    console.log('   Password: ' + DEMO_USER_PASSWORD);
    console.log('   Role:     ' + demoUser.role);
    console.log('   ID:       ' + demoUser.id);
    console.log('');

    // Check if there's an admin user whose content the demo user will see
    const adminUser = await prisma.user.findFirst({
      where: { role: 'admin' },
      select: {
        id: true,
        email: true,
        _count: {
          select: {
            episodes: true,
            courses: true,
            narrowListeningPacks: true,
            chunkPacks: true,
          },
        },
      },
    });

    if (adminUser) {
      const totalContent =
        adminUser._count.episodes +
        adminUser._count.courses +
        adminUser._count.narrowListeningPacks +
        adminUser._count.chunkPacks;

      console.log('📚 Demo user will see content from admin: ' + adminUser.email);
      console.log('   Total content items: ' + totalContent);
    } else {
      console.log('⚠️  No admin user found. Demo user will see empty library.');
      console.log('   Create content with an admin account first.');
    }
  } catch (error) {
    console.error('❌ Failed to seed demo user:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedDemoUser();
