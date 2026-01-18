import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  const courseId = process.argv[2];

  if (!courseId) {
    console.error('Usage: npx tsx check-course-episodes.ts <course-id>');
    process.exit(1);
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      courseEpisodes: {
        include: {
          episode: {
            select: {
              id: true,
              title: true,
              sourceText: true,
            },
          },
        },
        orderBy: { order: 'asc' },
      },
      user: {
        select: {
          email: true,
        },
      },
    },
  });

  if (!course) {
    console.log(`❌ Course not found: ${courseId}`);
    process.exit(1);
  }

  console.log('\n📚 Course Details:');
  console.log(`  ID: ${course.id}`);
  console.log(`  Title: ${course.title}`);
  console.log(`  Status: ${course.status}`);
  console.log(`  User: ${course.user.email}`);
  console.log(`  Episodes: ${course.courseEpisodes.length}`);

  if (course.courseEpisodes.length === 0) {
    console.log('\n❌ No episodes linked to this course');
    console.log('\nSearching for episodes that might belong to this user...\n');

    const userEpisodes = await prisma.episode.findMany({
      where: {
        userId: course.userId,
      },
      select: {
        id: true,
        title: true,
        sourceText: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    console.log(`Found ${userEpisodes.length} episodes for this user:`);
    for (const ep of userEpisodes) {
      console.log(`  - ${ep.id}: ${ep.title}`);
      console.log(`    Has source text: ${!!ep.sourceText}`);
      console.log(`    Created: ${ep.createdAt}`);
    }
  } else {
    console.log('\n✅ Course episodes:');
    for (const ce of course.courseEpisodes) {
      console.log(`  ${ce.order}. ${ce.episode.title} (${ce.episode.id})`);
      console.log(`     Has source text: ${!!ce.episode.sourceText}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
