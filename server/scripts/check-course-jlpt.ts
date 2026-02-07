import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCourseJLPT() {
  const courses = await prisma.course.findMany({
    select: {
      id: true,
      title: true,
      jlptLevel: true,
      targetLanguage: true,
      status: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 10,
  });

  console.log('\n=== Recent Courses ===\n');
  for (const course of courses) {
    console.log(`ID: ${course.id}`);
    console.log(`Title: ${course.title}`);
    console.log(`Target Language: ${course.targetLanguage}`);
    console.log(`JLPT Level: ${course.jlptLevel || 'NOT SET'}`);
    console.log(`Status: ${course.status}`);
    console.log('---');
  }

  await prisma.$disconnect();
}

checkCourseJLPT().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
