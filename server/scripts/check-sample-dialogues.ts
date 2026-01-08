import { prisma } from '../src/db/client.js';

async function checkSampleDialogues() {
  const episodes = await prisma.episode.findMany({
    where: { isSampleContent: true },
    include: { dialogue: { include: { sentences: true } } },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`\n📊 Sample Dialogues Status\n`);
  console.log(`Total sample episodes: ${episodes.length}\n`);

  episodes.forEach((episode, index) => {
    const sentenceCount = episode.dialogue?.sentences.length || 0;
    console.log(`${index + 1}. ${episode.title}`);
    console.log(`   Status: ${episode.status}`);
    console.log(`   Episode ID: ${episode.id}`);
    console.log(`   Sentences: ${sentenceCount}`);
    console.log(`   Created: ${episode.createdAt.toISOString()}`);
    console.log('');
  });

  await prisma.$disconnect();
}

checkSampleDialogues();
