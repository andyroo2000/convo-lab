import { prisma } from '../src/db/client.js';

async function getCourseAudioUrl() {
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
      audioUrl: true,
      approxDurationSeconds: true,
      _count: {
        select: {
          coreItems: true,
        },
      },
    },
  });

  if (course) {
    console.log('\n📚 Course: Travel & Transportation (Japanese N5)');
    console.log(`Duration: ${Math.floor(course.approxDurationSeconds / 60)}:${(course.approxDurationSeconds % 60).toString().padStart(2, '0')}`);
    console.log(`Vocabulary Items: ${course._count.coreItems}`);
    console.log(`\n🔊 Audio URL:\n${course.audioUrl}\n`);
  } else {
    console.log('Course not found');
  }

  await prisma.$disconnect();
}

getCourseAudioUrl();
