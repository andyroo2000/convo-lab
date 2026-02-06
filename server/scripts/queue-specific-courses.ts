import { PrismaClient, Prisma } from '@prisma/client';
import { courseQueue } from '../src/jobs/courseQueue.js';

const prisma = new PrismaClient();

async function queueSpecificCourses() {
  const targets = [
    { lang: 'ja', level: 'N4', field: 'jlptLevel' as const },
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
      if (course.status === 'error') {
        await prisma.course.update({
          where: { id: course.id },
          data: {
            status: 'draft',
            audioUrl: null,
            scriptJson: null,
            approxDurationSeconds: null,
            timingData: null,
          },
        });
        const langUpper = target.lang.toUpperCase();
        console.log('Reset ' + langUpper + ' ' + target.level + ' from error to draft');
      }

      const job = await courseQueue.add('generate', { courseId: course.id });
      const langUpper = target.lang.toUpperCase();
      console.log('Queued ' + langUpper + ' ' + target.level + ' - Job #' + job.id);
    } else {
      const langUpper = target.lang.toUpperCase();
      console.log('Not found: ' + langUpper + ' ' + target.level);
    }
  }

  await prisma.$disconnect();
}

queueSpecificCourses()
  .catch(console.error)
  .finally(() => process.exit(0));
