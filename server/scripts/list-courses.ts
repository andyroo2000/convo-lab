import { prisma } from '../src/db/client.js';

async function main() {
  const courses = await prisma.course.findMany({
    select: { id: true, title: true, l1VoiceId: true, status: true },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  console.log('Recent courses:');
  for (const c of courses) {
    console.log(`  ${c.title} | ${c.l1VoiceId} | ${c.status}`);
  }

  await prisma.$disconnect();
}

main();
