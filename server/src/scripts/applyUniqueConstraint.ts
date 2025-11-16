#!/usr/bin/env node
import { prisma } from '../db/client.js';

async function applyConstraint() {
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Lesson_courseId_order_key"
    ON "Lesson"("courseId", "order");
  `);

  console.log('✅ Applied unique constraint on (courseId, order)');

  await prisma.$disconnect();
  process.exit(0);
}

applyConstraint();
