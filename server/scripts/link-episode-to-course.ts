import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  const courseId = process.argv[2];
  const episodeId = process.argv[3];

  if (!courseId || !episodeId) {
    console.error('Usage: npx tsx link-episode-to-course.ts <courseId> <episodeId>');
    process.exit(1);
  }

  // Check if link already exists
  const existing = await prisma.courseEpisode.findUnique({
    where: {
      courseId_episodeId: {
        courseId,
        episodeId,
      },
    },
  });

  if (existing) {
    console.log('✅ Episode already linked to course');
    return;
  }

  // Create the link
  await prisma.courseEpisode.create({
    data: {
      courseId,
      episodeId,
      order: 1,
    },
  });

  console.log(`✅ Linked episode ${episodeId} to course ${courseId}`);

  // Show course details
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      courseEpisodes: {
        include: {
          episode: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
    },
  });

  console.log(`\n📚 Course now has ${course?.courseEpisodes.length} episodes:`);
  for (const ce of course?.courseEpisodes || []) {
    console.log(`  ${ce.order}. ${ce.episode.title}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
