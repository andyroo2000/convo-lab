import { prisma } from '../src/db/client.js';

async function checkCourseStatus() {
  const course = await prisma.course.findFirst({
    where: {
      title: 'Travel & Transportation',
      targetLanguage: 'ja',
      jlptLevel: 'N5',
      isSampleContent: true,
    },
    select: {
      id: true,
      title: true,
      status: true,
      approxDurationSeconds: true,
      audioUrl: true,
      _count: {
        select: {
          coreItems: true,
        },
      },
    },
  });

  console.log('\n📚 Course Status:\n');
  if (course) {
    console.log(`ID: ${course.id}`);
    console.log(`Title: ${course.title}`);
    console.log(`Status: ${course.status}`);
    console.log(`Duration: ${course.approxDurationSeconds ? `${course.approxDurationSeconds}s` : 'Not set'}`);
    console.log(`Audio URL: ${course.audioUrl ? 'Generated' : 'Not generated'}`);
    console.log(`Core Items: ${course._count.coreItems}`);
  } else {
    console.log('Course not found');
  }

  await prisma.$disconnect();
}

checkCourseStatus();
