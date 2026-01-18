import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  const dialogId = process.argv[2];

  if (!dialogId) {
    console.error('Usage: npx tsx check-dialog-status.ts <dialog-id>');
    process.exit(1);
  }

  const dialogue = await prisma.dialogue.findUnique({
    where: { id: dialogId },
    include: {
      episode: {
        select: {
          id: true,
          title: true,
          status: true,
          audioUrl: true,
        },
      },
      sentences: {
        select: {
          id: true,
          order: true,
          text: true,
          audioUrl: true,
        },
        orderBy: { order: 'asc' },
        take: 5,
      },
    },
  });

  if (!dialogue) {
    console.log(`Dialogue not found: ${dialogId}`);
    process.exit(1);
  }

  console.log('\nDialogue Details:');
  console.log(`  ID: ${dialogue.id}`);
  console.log(`  Episode: ${dialogue.episode.title} (${dialogue.episode.id})`);
  console.log(`  Episode Status: ${dialogue.episode.status}`);
  console.log(`  Episode Audio: ${dialogue.episode.audioUrl ? 'Yes' : 'No'}`);
  console.log(`  Created: ${dialogue.createdAt}`);
  console.log(`  Updated: ${dialogue.updatedAt}`);

  const totalSentences = await prisma.sentence.count({
    where: { dialogueId },
  });

  const withAudio = await prisma.sentence.count({
    where: {
      dialogueId,
      audioUrl: { not: null },
    },
  });

  console.log(`\nSentence Audio Status:`);
  console.log(`  Total sentences: ${totalSentences}`);
  console.log(`  With audio: ${withAudio}`);
  console.log(`  Missing audio: ${totalSentences - withAudio}`);

  if (dialogue.sentences.length > 0) {
    console.log(`\nFirst 5 sentences:`);
    for (const s of dialogue.sentences) {
      console.log(`  ${s.order}. ${s.text.substring(0, 50)}...`);
      console.log(`     Audio: ${s.audioUrl ? 'Yes' : 'NO'}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
