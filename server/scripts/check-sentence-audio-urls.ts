import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  const dialogueId = process.argv[2];

  if (!dialogueId) {
    console.error('Usage: npx tsx check-sentence-audio-urls.ts <dialogue-id>');
    process.exit(1);
  }

  const sentences = await prisma.sentence.findMany({
    where: { dialogueId },
    select: {
      id: true,
      order: true,
      text: true,
      audioUrl: true,
      audioUrl_0_7: true,
      audioUrl_0_85: true,
      audioUrl_1_0: true,
    },
    orderBy: { order: 'asc' },
    take: 10,
  });

  console.log(`\nFound ${sentences.length} sentences:`);
  for (const s of sentences) {
    const preview = s.text.length > 50 ? s.text.substring(0, 50) + '...' : s.text;
    console.log(`\n${s.order}. ${preview}`);
    console.log(`   audioUrl: ${s.audioUrl || 'NULL'}`);
    console.log(`   audioUrl_0_7: ${s.audioUrl_0_7 || 'NULL'}`);
    console.log(`   audioUrl_0_85: ${s.audioUrl_0_85 || 'NULL'}`);
    console.log(`   audioUrl_1_0: ${s.audioUrl_1_0 || 'NULL'}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
