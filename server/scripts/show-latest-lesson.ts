import { prisma } from '../src/db/client.js';

async function getAllLessons() {
  const lessons = await prisma.lesson.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      course: {
        select: {
          title: true,
          status: true
        }
      }
    }
  });

  console.log('Found', lessons.length, 'lessons\n');

  for (const lesson of lessons) {
    console.log('=== LESSON ===');
    console.log('ID:', lesson.id);
    console.log('Title:', lesson.title);
    console.log('Course:', lesson.course.title, '(status:', lesson.course.status + ')');
    console.log('Lesson Status:', lesson.status);
    console.log('Created:', lesson.createdAt);
    const units = lesson.scriptJson as any[];
    console.log('Script Units:', units?.length || 'N/A');

    if (units && units.length > 0) {
      console.log('\n=== FIRST 30 SCRIPT UNITS ===');
      console.log(JSON.stringify(units.slice(0, 30), null, 2));
      console.log('\n... (showing first 30 of', units.length, 'total units)\n');
    }
  }

  await prisma.$disconnect();
}

getAllLessons().catch(console.error);
