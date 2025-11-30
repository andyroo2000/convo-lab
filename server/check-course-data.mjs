import { prisma } from './src/db/client.js';

async function main() {
  const course = await prisma.course.findUnique({
    where: { id: '59871294-b1f5-4d29-b6c7-e0f152d538d5' },
    include: {
      coreItems: true,
      courseEpisodes: {
        include: {
          episode: true
        }
      }
    }
  });

  console.log('Course data:');
  console.log('- Title:', course?.title);
  console.log('- Status:', course?.status);
  console.log('- Audio URL:', course?.audioUrl);
  console.log('- Duration:', course?.approxDurationSeconds);
  console.log('- Script JSON:', course?.scriptJson ? 'exists' : 'null');
  console.log('- Core Items count:', course?.coreItems?.length || 0);
  console.log('- Episodes count:', course?.courseEpisodes?.length || 0);

  if (!course) {
    console.log('Course not found!');
  }

  await prisma.$disconnect();
}

main();
