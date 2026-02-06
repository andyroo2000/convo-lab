#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://languageflow:Kx9mP2vNwQ7bL5tRj8dF3hYzW6cM4nXs@34.57.57.13:5432/languageflow?schema=public',
    },
  },
});

async function main() {
  const yuriy = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { contains: 'yuriy', mode: 'insensitive' } },
        { name: { contains: 'yuriy', mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  });

  if (!yuriy) {
    console.log('Yuriy not found');
    process.exit(1);
  }

  console.log(`\nYuriy's account:`);
  console.log(`  ID: ${yuriy.id}`);
  console.log(`  Email: ${yuriy.email}`);
  console.log(`  Name: ${yuriy.name}`);
  console.log(`  Role: ${yuriy.role}`);

  // Find his courses
  const courses = await prisma.course.findMany({
    where: { userId: yuriy.id },
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  console.log(`\nYuriy's courses (${courses.length}):`);
  for (const course of courses) {
    console.log(`  - ${course.id}: ${course.title} (${course.status})`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
