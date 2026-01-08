import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCourseVoices() {
  const courses = await prisma.course.findMany({
    where: { isSampleContent: true },
    select: {
      id: true,
      title: true,
      targetLanguage: true,
      l1VoiceId: true,
      l1VoiceProvider: true,
      speaker1VoiceId: true,
      speaker1VoiceProvider: true,
      speaker2VoiceId: true,
      speaker2VoiceProvider: true,
    },
  });

  const mismatches: Array<{
    courseId: string;
    title: string;
    fixes: Array<{
      field: string;
      voiceId: string;
      currentProvider: string;
      correctProvider: string;
    }>;
  }> = [];

  for (const course of courses) {
    const fixes: Array<{
      field: string;
      voiceId: string;
      currentProvider: string;
      correctProvider: string;
    }> = [];

    // Check l1VoiceId
    if (course.l1VoiceId) {
      const isAzure = course.l1VoiceId.endsWith('Neural');
      const isPolly = !course.l1VoiceId.includes('-');
      const expectedProvider = isAzure ? 'azure' : isPolly ? 'polly' : 'google';
      if (course.l1VoiceProvider !== expectedProvider) {
        fixes.push({
          field: 'l1VoiceProvider',
          voiceId: course.l1VoiceId,
          currentProvider: course.l1VoiceProvider,
          correctProvider: expectedProvider,
        });
      }
    }

    // Check speaker1VoiceId
    if (course.speaker1VoiceId) {
      const isAzure = course.speaker1VoiceId.endsWith('Neural');
      const isPolly = !course.speaker1VoiceId.includes('-');
      const expectedProvider = isAzure ? 'azure' : isPolly ? 'polly' : 'google';
      if (course.speaker1VoiceProvider !== expectedProvider) {
        fixes.push({
          field: 'speaker1VoiceProvider',
          voiceId: course.speaker1VoiceId,
          currentProvider: course.speaker1VoiceProvider,
          correctProvider: expectedProvider,
        });
      }
    }

    // Check speaker2VoiceId
    if (course.speaker2VoiceId) {
      const isAzure = course.speaker2VoiceId.endsWith('Neural');
      const isPolly = !course.speaker2VoiceId.includes('-');
      const expectedProvider = isAzure ? 'azure' : isPolly ? 'polly' : 'google';
      if (course.speaker2VoiceProvider !== expectedProvider) {
        fixes.push({
          field: 'speaker2VoiceProvider',
          voiceId: course.speaker2VoiceId,
          currentProvider: course.speaker2VoiceProvider,
          correctProvider: expectedProvider,
        });
      }
    }

    if (fixes.length > 0) {
      mismatches.push({
        courseId: course.id,
        title: course.title,
        fixes,
      });
    }
  }

  if (mismatches.length === 0) {
    console.log('✅ No course voice provider mismatches found!\n');
    return;
  }

  console.log(`Found ${mismatches.length} courses with voice provider mismatches:\n`);
  for (const mismatch of mismatches) {
    console.log(`${mismatch.title}:`);
    for (const fix of mismatch.fixes) {
      console.log(
        `  ${fix.field}: ${fix.voiceId} (${fix.currentProvider} → ${fix.correctProvider})`
      );
    }
  }

  console.log('\n🔧 Fixing all course voice providers...\n');

  // Fix each course
  for (const mismatch of mismatches) {
    const updateData: Record<string, string> = {};
    for (const fix of mismatch.fixes) {
      updateData[fix.field] = fix.correctProvider;
    }

    await prisma.course.update({
      where: { id: mismatch.courseId },
      data: updateData,
    });
  }

  console.log(`✅ Fixed ${mismatches.length} courses!\n`);
}

checkCourseVoices()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
