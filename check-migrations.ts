import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://languageflow:Kx9mP2vNwQ7bL5tRj8dF3hYzW6cM4nXs@34.57.57.13:5432/languageflow?schema=public"
    }
  }
});

async function main() {
  console.log('Checking applied migrations in production...\n');

  const migrations = await prisma.$queryRaw`
    SELECT migration_name, finished_at
    FROM "_prisma_migrations"
    ORDER BY finished_at DESC
    LIMIT 10
  `;

  console.log('Recent migrations:', migrations);

  // Check if Lesson table exists
  const tables = await prisma.$queryRaw`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN ('Lesson', 'Course', 'CourseCoreItem', 'LessonCoreItem')
    ORDER BY tablename
  `;

  console.log('\nRelevant tables:', tables);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
