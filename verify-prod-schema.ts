import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://languageflow:Kx9mP2vNwQ7bL5tRj8dF3hYzW6cM4nXs@34.57.57.13:5432/languageflow?schema=public"
    }
  }
});

async function main() {
  console.log('Checking production database schema...\n');

  // Check NarrowListeningPack columns
  const nlColumns = await prisma.$queryRaw`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'NarrowListeningPack'
    ORDER BY column_name
  `;
  console.log('NarrowListeningPack columns:', nlColumns);

  // Test fetching a pack
  try {
    const packs = await prisma.narrowListeningPack.findMany({
      take: 1,
      select: {
        id: true,
        title: true,
        jlptLevel: true,
        hskLevel: true,
        targetLanguage: true
      }
    });
    console.log('\nSuccessfully fetched pack with hskLevel:', packs);
  } catch (error) {
    console.error('\nError fetching pack:', error);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
