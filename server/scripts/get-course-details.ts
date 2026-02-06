import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  const courseId = process.argv[2];

  if (!courseId) {
    console.error('Usage: npx tsx get-course-details.ts <course-id>');
    process.exit(1);
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      user: {
        select: { email: true, name: true }
      },
      coreItems: {
        select: { id: true },
        take: 5
      }
    }
  });

  if (!course) {
    console.log('Course not found');
    return;
  }

  console.log('\n=== Course Details ===\n');
  console.log('ID:', course.id);
  console.log('Title:', course.title);
  console.log('Description:', course.description);
  console.log('Status:', course.status);
  console.log('\nUser:', course.user.name, `(${course.user.email})`);
  console.log('\nLanguages:');
  console.log('  Native (L1):', course.nativeLanguage);
  console.log('  Target (L2):', course.targetLanguage);
  console.log('\nSettings:');
  console.log('  Max lesson duration:', course.maxLessonDurationMinutes, 'minutes');
  console.log('  JLPT Level:', course.jlptLevel || 'N/A');
  console.log('\nVoices:');
  console.log('  L1 Voice:', course.l1VoiceId, `(${course.l1VoiceProvider})`);
  console.log('  Speaker 1:', course.speaker1VoiceId, `(${course.speaker1VoiceProvider}, ${course.speaker1Gender})`);
  console.log('  Speaker 2:', course.speaker2VoiceId, `(${course.speaker2VoiceProvider}, ${course.speaker2Gender})`);
  console.log('\nAudio:');
  console.log('  Duration:', course.approxDurationSeconds, 'seconds');
  console.log('  Audio URL:', course.audioUrl ? 'Yes' : 'No');
  console.log('  Core items count:', await prisma.courseCoreItem.count({ where: { courseId: course.id } }));
  console.log('\nTimestamps:');
  console.log('  Created:', course.createdAt);
  console.log('  Updated:', course.updatedAt);

  await prisma.$disconnect();
}

main().catch(console.error);
