import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const schemaPath = new URL('../../../../prisma/schema.prisma', import.meta.url);
const migrationPath = new URL(
  '../../../../prisma/migrations/20260412123600_add_study_subsystem/migration.sql',
  import.meta.url
);

describe('study schema verification', () => {
  it('keeps the StudyCard(noteId) index in both schema and migration history', async () => {
    const [schema, migration] = await Promise.all([
      readFile(schemaPath, 'utf8'),
      readFile(migrationPath, 'utf8'),
    ]);

    expect(schema).toContain('@@index([noteId])');
    expect(migration).toContain(
      'CREATE INDEX "study_cards_noteId_idx" ON "study_cards"("noteId");'
    );
  });
});
