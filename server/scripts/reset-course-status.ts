import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  const courseId = process.argv[2];
  
  if (!courseId) {
    console.error('Usage: npx tsx reset-course-status.ts <course-id>');
    process.exit(1);
  }
  
  console.log(`Resetting course ${courseId} to pending...`);
  
  await prisma.course.update({
    where: { id: courseId },
    data: { status: 'pending' }
  });
  
  console.log('✅ Course status reset to pending');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
