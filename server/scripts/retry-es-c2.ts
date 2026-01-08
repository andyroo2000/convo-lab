import { PrismaClient } from '@prisma/client';
import { courseQueue } from '../src/jobs/courseQueue.js';

const prisma = new PrismaClient();

async function main() {
  const course = await prisma.course.findFirst({
    where: {
      title: 'Travel & Transportation',
      targetLanguage: 'es',
      cefrLevel: 'C2',
      isSampleContent: true
    }
  });
  
  if (!course) {
    console.log('Course not found');
    return;
  }
  
  await prisma.courseCoreItem.deleteMany({
    where: { courseId: course.id }
  });
  
  await prisma.course.update({
    where: { id: course.id },
    data: {
      status: 'draft',
      audioUrl: null,
      scriptJson: null,
      approxDurationSeconds: null,
      timingData: null,
    }
  });
  
  console.log('Reset ES C2 course - deleted corrupt script');
  
  const job = await courseQueue.add('generate', { courseId: course.id });
  console.log('Queued ES C2 - Job #' + job.id);
  
  await prisma.$disconnect();
}

main().catch(console.error).finally(() => process.exit(0));
