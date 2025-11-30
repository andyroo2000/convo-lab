import { prisma } from '../db/client.js';

async function main() {
  const courses = await prisma.course.findMany({
    select: {
      id: true,
      title: true,
      status: true,
      audioUrl: true,
      approxDurationSeconds: true,
      _count: {
        select: {
          coreItems: true
        }
      }
    },
    take: 10
  });

  console.log(`\n=== Found ${courses.length} courses ===\n`);

  courses.forEach(course => {
    const hasData = !!(course.audioUrl || course.approxDurationSeconds);
    console.log(`${course.id.substring(0, 8)}... - ${course.title}`);
    console.log(`  Status: ${course.status}`);
    console.log(`  Has Audio: ${!!course.audioUrl}`);
    console.log(`  Duration: ${course.approxDurationSeconds || 'NULL'}`);
    console.log(`  Core Items: ${course._count.coreItems}`);
    console.log(`  ${hasData ? '✓ HAS DATA' : '✗ NO DATA'}`);
    console.log('');
  });

  const coursesWithData = courses.filter(c => c.audioUrl || c.approxDurationSeconds);
  console.log(`Summary: ${coursesWithData.length}/${courses.length} courses have lesson data`);

  await prisma.$disconnect();
}

main().catch(console.error);
