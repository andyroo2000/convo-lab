import { prisma } from '../src/db/client.js';

async function main() {
  const lessons = await prisma.lesson.findMany({
    select: { id: true, title: true, scriptJson: true, status: true },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  console.log('Recent lessons:');
  for (const lesson of lessons) {
    const script = lesson.scriptJson as any[];
    if (!script || script.length === 0) {
      console.log(`  ${lesson.title} | status: ${lesson.status} | No script`);
      continue;
    }

    // Find all unique voiceIds
    const voiceIds = new Set<string>();
    for (const unit of script) {
      if (unit.voiceId) voiceIds.add(unit.voiceId);
    }

    console.log(`  ${lesson.title} | status: ${lesson.status}`);
    console.log(`    voiceIds: ${[...voiceIds].join(', ')}`);
  }

  await prisma.$disconnect();
}

main();
