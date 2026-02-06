import { PrismaClient, Prisma } from '@prisma/client';
import { courseQueue } from '../src/jobs/courseQueue.js';

const prisma = new PrismaClient();

async function main() {
  const targets = [
    { lang: 'ja', level: 'N4', field: 'jlptLevel' },
  ];

  for (const target of targets) {
    const where: Prisma.CourseWhereInput = {
      title: 'Travel & Transportation',
      targetLanguage: target.lang,
      isSampleContent: true,
    };
    where[target.field] = target.level;
    
    const course = await prisma.course.findFirst({ where });
    
    if (course) {
      const job = await courseQueue.add('generate', { courseId: course.id });
      console.log('Queued ' + target.lang.toUpperCase() + ' ' + target.level + ' - Job #' + job.id);
    }
  }
  
  await prisma.$disconnect();
}

main().catch(console.error).finally(() => process.exit(0));
