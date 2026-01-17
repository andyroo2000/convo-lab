#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  const userId = process.argv[2];

  if (!userId) {
    console.error('Usage: npx tsx scripts/verify-user-email.ts <user-id>');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      emailVerified: true,
    },
  });

  if (!user) {
    console.error(`User not found: ${userId}`);
    process.exit(1);
  }

  console.log('\n=== User Details ===');
  console.log('User ID:', user.id);
  console.log('Email:', user.email);
  console.log('Name:', user.name);
  console.log('Currently Verified:', user.emailVerified);

  if (user.emailVerified) {
    console.log('\n✅ Email is already verified!');
    process.exit(0);
  }

  console.log('\n🔄 Verifying email...');

  await prisma.user.update({
    where: { id: userId },
    data: {
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  console.log('✅ Email verified successfully!');
  console.log(`\n${user.name} can now generate content.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
