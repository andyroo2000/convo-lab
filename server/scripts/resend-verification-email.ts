#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import { sendVerificationEmail } from '../src/services/emailService.js';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  const userId = process.argv[2];

  if (!userId) {
    console.error('Usage: npx tsx scripts/resend-verification-email.ts <user-id>');
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

  console.log('\n🔄 Resending verification email...');

  try {
    await sendVerificationEmail(user.id, user.email, user.name);
    console.log('✅ Verification email sent successfully!');
    console.log(`\nEmail sent to: ${user.email}`);
    console.log('The verification link expires in 24 hours.');
  } catch (error) {
    console.error('❌ Failed to send verification email:', error);
    process.exit(1);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
