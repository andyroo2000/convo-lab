import { PrismaClient } from '@prisma/client';
import { courseQueue } from '../src/jobs/courseQueue.js';

const prisma = new PrismaClient();

async function main() {
  const targets = [
    { lang: 'ar', level: 'A2', field: 'cefrLevel' },
    { lang: 'ar', level: 'B1', field: 'cefrLevel' },
    { lang: 'ja', level: 'N4', field: 'jlptLevel' },
  ];

  for (const target of targets) {
    const where: any = {
      title: 'Travel & Transportation',
      targetLanguage: target.lang,
      isSampleContent: true,
    };
    where[target.field] = target.level;

    const course = await prisma.course.findFirst({ where });

    if (course) {
      // Clean up any corrupt data
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

      const job = await courseQueue.add('generate', { courseId: course.id });
      console.log('Queued ' + target.lang.toUpperCase() + ' ' + target.level + ' - Job #' + job.id);
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error).finally(() => process.exit(0));
