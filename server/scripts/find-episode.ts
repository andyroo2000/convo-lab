import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  const title = process.argv[2];
  const userId = process.argv[3];

  if (!title || !userId) {
    console.error('Usage: npx tsx find-episode.ts <title> <userId>');
    process.exit(1);
  }

  // Search for episode by title
  const episodes = await prisma.episode.findMany({
    where: {
      title: {
        contains: title,
        mode: 'insensitive',
      },
      userId,
    },
    select: {
      id: true,
      title: true,
      sourceText: true,
      createdAt: true,
    },
  });

  console.log(`\nFound ${episodes.length} episodes matching "${title}":`);
  for (const ep of episodes) {
    console.log(`\n  ID: ${ep.id}`);
    console.log(`  Title: ${ep.title}`);
    console.log(`  Has source text: ${!!ep.sourceText}`);
    console.log(`  Created: ${ep.createdAt}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
