import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { contains: 'yuriy', mode: 'insensitive' } },
        { name: { contains: 'yuriy', mode: 'insensitive' } }
      ]
    },
    select: { id: true, email: true, name: true }
  });

  if (!user) {
    console.log('User not found');
    return;
  }

  console.log('Found user:', JSON.stringify(user, null, 2));

  const courses = await prisma.course.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      title: true,
      status: true,
      description: true,
      targetLanguage: true,
      nativeLanguage: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log('\nCourses:');
  for (const course of courses) {
    console.log(`\n- ${course.title}`);
    console.log(`  ID: ${course.id}`);
    console.log(`  Status: ${course.status}`);
    console.log(`  Languages: ${course.nativeLanguage} → ${course.targetLanguage}`);
    console.log(`  Created: ${course.createdAt}`);
    console.log(`  Updated: ${course.updatedAt}`);
    if (course.description) {
      console.log(`  Description: ${course.description.substring(0, 100)}...`);
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
