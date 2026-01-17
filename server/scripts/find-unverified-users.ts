#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  console.log('\n=== Database Connection ===');
  console.log('Using DATABASE_URL from environment');

  // Find users with unverified emails who have created courses or dialogues recently
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  const unverifiedUsersWithContent = await prisma.user.findMany({
    where: {
      emailVerified: false,
      OR: [
        {
          courses: {
            some: {
              createdAt: {
                gte: threeDaysAgo,
              },
            },
          },
        },
        {
          episodes: {
            some: {
              createdAt: {
                gte: threeDaysAgo,
              },
            },
          },
        },
      ],
    },
    select: {
      id: true,
      email: true,
      name: true,
      emailVerified: true,
      createdAt: true,
      _count: {
        select: {
          courses: true,
          episodes: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  console.log(`\n=== ${unverifiedUsersWithContent.length} Unverified Users with Recent Content ===\n`);

  for (const user of unverifiedUsersWithContent) {
    console.log('User ID:', user.id);
    console.log('Email:', user.email);
    console.log('Name:', user.name);
    console.log('Signed Up:', user.createdAt.toISOString());
    console.log('Courses:', user._count.courses);
    console.log('Episodes:', user._count.episodes);
    console.log('---');
  }

  if (unverifiedUsersWithContent.length > 0) {
    console.log('\n💡 To verify an email, run:');
    console.log('npx tsx scripts/verify-user-email.ts <user-id>');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
