import { prisma } from '../db/client.js';

async function main() {
  const courseId = '59871294-b1f5-4d29-b6c7-e0f152d538d5';

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      coreItems: true,
      courseEpisodes: true
    }
  });

  console.log('\n=== Course Data ===');
  console.log('ID:', course?.id);
  console.log('Title:', course?.title);
  console.log('Status:', course?.status);
  console.log('Audio URL:', course?.audioUrl || 'NULL');
  console.log('Duration (seconds):', course?.approxDurationSeconds || 'NULL');
  console.log('Script JSON:', course?.scriptJson ? `exists (${JSON.stringify(course.scriptJson).length} chars)` : 'NULL');
  console.log('Core Items:', course?.coreItems?.length || 0);
  console.log('Episodes:', course?.courseEpisodes?.length || 0);

  if (!course) {
    console.log('\nCourse NOT FOUND in database!');
  } else if (!course.audioUrl && !course.scriptJson) {
    console.log('\nCourse exists but has NO LESSON DATA (audioUrl and scriptJson are null)');
    console.log('This means the migration did not copy lesson data, or this course was created after lessons were removed.');
  }

  await prisma.$disconnect();
}

main().catch(console.error);
