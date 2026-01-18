import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  const courseId = process.argv[2];

  if (!courseId) {
    console.error('Usage: npx tsx delete-course.ts <course-id>');
    process.exit(1);
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      user: { select: { name: true, email: true } },
      coreItems: { select: { id: true }, take: 1 },
    },
  });

  if (!course) {
    console.log('Course not found');
    return;
  }

  console.log('\n=== Course to Delete ===');
  console.log(`Title: ${course.title}`);
  console.log(`User: ${course.user.name} (${course.user.email})`);
  console.log(`Status: ${course.status}`);
  console.log(`Created: ${course.createdAt}`);

  // Count related items
  const coreItemsCount = await prisma.courseCoreItem.count({ where: { courseId } });
  const episodesCount = await prisma.courseEpisode.count({ where: { courseId } });

  console.log(`\nRelated data:`);
  console.log(`  Core items: ${coreItemsCount}`);
  console.log(`  Episodes: ${episodesCount}`);

  console.log('\nDeleting course...');

  // Delete in correct order (foreign key constraints)
  // 1. Delete core items
  await prisma.courseCoreItem.deleteMany({ where: { courseId } });
  console.log(`  ✓ Deleted ${coreItemsCount} core items`);

  // 2. Delete course episodes
  await prisma.courseEpisode.deleteMany({ where: { courseId } });
  console.log(`  ✓ Deleted ${episodesCount} episodes`);

  // 3. Delete the course
  await prisma.course.delete({ where: { id: courseId } });
  console.log(`  ✓ Deleted course`);

  console.log('\n✅ Course deleted successfully!');

  await prisma.$disconnect();
}

main().catch(console.error);
