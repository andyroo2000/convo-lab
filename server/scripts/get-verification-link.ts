#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

const CLIENT_URL = process.env.CLIENT_URL || 'https://convo-lab.com';

async function main() {
  const userId = process.argv[2];

  if (!userId) {
    console.error('Usage: npx tsx scripts/get-verification-link.ts <user-id>');
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

  // Get verification token
  const token = await prisma.emailVerificationToken.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });

  if (!token) {
    console.log('\n⚠️  No verification token found.');
    console.log('Run: npx tsx scripts/resend-verification-email.ts', user.id);
    process.exit(0);
  }

  const now = new Date();
  const isExpired = token.expiresAt < now;

  console.log('\n=== Verification Token ===');
  console.log('Token:', token.token);
  console.log('Created:', token.createdAt.toISOString());
  console.log('Expires:', token.expiresAt.toISOString());
  console.log('Status:', isExpired ? '❌ EXPIRED' : '✅ Valid');

  if (isExpired) {
    console.log('\n⚠️  Token has expired.');
    console.log('Run: npx tsx scripts/resend-verification-email.ts', user.id);
    process.exit(0);
  }

  const verificationUrl = `${CLIENT_URL}/verify-email/${token.token}`;
  console.log('\n=== Verification Link ===');
  console.log(verificationUrl);
  console.log('\nYou can share this link with the user to verify their email.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
