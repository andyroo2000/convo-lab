#!/usr/bin/env node
import { prisma } from '../db/client.js';

async function inspectLatestLesson() {
  const lesson = await prisma.lesson.findFirst({
    where: {
      status: { in: ['ready', 'generating'] },
    },
    include: {
      course: true,
      coreItems: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (!lesson) {
    console.log('No lessons found.');
    await prisma.$disconnect();
    process.exit(0);
    return;
  }

  console.log(`Lesson: ${lesson.title}`);
  console.log(`Status: ${lesson.status}`);
  console.log(`\nCore Vocabulary Items (${lesson.coreItems.length}):`);

  for (const item of lesson.coreItems) {
    console.log(`\n  - ${item.translationL1}`);
    console.log(`    Text L2: "${item.textL2}"`);
    console.log(`    Reading L2: "${item.readingL2}"`);
  }

  console.log(`\n\nScript Preview (first 10 units):`);
  const scriptUnits = lesson.scriptJson as any[];
  for (let i = 0; i < Math.min(10, scriptUnits.length); i++) {
    const unit = scriptUnits[i];
    if (unit.type === 'narration_L1') {
      console.log(`  [Narrator] ${unit.text}`);
    } else if (unit.type === 'L2') {
      console.log(`  [L2 ${unit.speed}x] Text: "${unit.text}"${unit.reading ? `, Reading: "${unit.reading}"` : ''}`);
    } else if (unit.type === 'pause') {
      console.log(`  [Pause ${unit.seconds}s]`);
    } else if (unit.type === 'marker') {
      console.log(`  [Marker: ${unit.label}]`);
    }
  }

  await prisma.$disconnect();
  process.exit(0);
}

inspectLatestLesson();
