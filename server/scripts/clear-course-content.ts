import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  const courseId = process.argv[2];

  if (!courseId) {
    console.error('Usage: npx tsx clear-course-content.ts <course-id>');
    process.exit(1);
  }

  console.log(`Clearing content for course ${courseId}...`);

  await prisma.course.update({
    where: { id: courseId },
    data: {
      audioUrl: null,
      scriptJson: null,
      timingData: null,
      approxDurationSeconds: null,
      status: 'pending',
    },
  });

  console.log('✅ Course content cleared and status set to pending');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
