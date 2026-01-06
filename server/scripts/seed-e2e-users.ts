/**
 * Seed script to create e2e test users
 *
 * Usage:
 *   npx tsx scripts/seed-e2e-users.ts
 *
 * This creates:
 *   1. Regular test user (from TEST_USER_EMAIL env var)
 *   2. Admin test user (from ADMIN_EMAIL env var or default)
 */

import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// In production, import from dist; in dev, import from src
const isProd = process.env.NODE_ENV === 'production';
const basePath = isProd ? '../dist/server/src' : '../src';

const { prisma } = await import(`${basePath}/db/client.js`);

// Test user credentials from environment or defaults
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'test.user@example.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'test123';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

async function seedE2EUsers() {
  console.log('🌱 Seeding e2e test users...\n');

  try {
    // Hash passwords
    const testUserHashedPassword = await bcrypt.hash(TEST_USER_PASSWORD, 10);
    const adminHashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

    // Create/update regular test user
    const testUser = await prisma.user.upsert({
      where: { email: TEST_USER_EMAIL },
      update: {
        role: 'user',
        tier: 'free',
        password: testUserHashedPassword,
        emailVerified: true,
      },
      create: {
        email: TEST_USER_EMAIL,
        password: testUserHashedPassword,
        name: 'Test User',
        role: 'user',
        tier: 'free',
        onboardingCompleted: true,
        preferredStudyLanguage: 'ja',
        preferredNativeLanguage: 'en',
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });

    console.log('✅ Regular test user created/updated successfully!');
    console.log('');
    console.log('   Email:    ' + TEST_USER_EMAIL);
    console.log('   Password: ' + TEST_USER_PASSWORD);
    console.log('   Role:     ' + testUser.role);
    console.log('   Tier:     ' + testUser.tier);
    console.log('   ID:       ' + testUser.id);
    console.log('');

    // Create/update admin test user
    const adminUser = await prisma.user.upsert({
      where: { email: ADMIN_EMAIL },
      update: {
        role: 'admin',
        tier: 'free',
        password: adminHashedPassword,
        emailVerified: true,
      },
      create: {
        email: ADMIN_EMAIL,
        password: adminHashedPassword,
        name: 'Admin User',
        role: 'admin',
        tier: 'free',
        onboardingCompleted: true,
        preferredStudyLanguage: 'ja',
        preferredNativeLanguage: 'en',
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });

    console.log('✅ Admin test user created/updated successfully!');
    console.log('');
    console.log('   Email:    ' + ADMIN_EMAIL);
    console.log('   Password: ' + ADMIN_PASSWORD);
    console.log('   Role:     ' + adminUser.role);
    console.log('   Tier:     ' + adminUser.tier);
    console.log('   ID:       ' + adminUser.id);
    console.log('');

    console.log('🎉 All e2e test users seeded successfully!');
  } catch (error) {
    console.error('❌ Failed to seed e2e test users:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedE2EUsers();
