import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const schemaPath = new URL('../../../../prisma/schema.prisma', import.meta.url);
const migrationPath = new URL(
  '../../../../prisma/migrations/20260412123600_add_study_subsystem/migration.sql',
  import.meta.url
);
const searchTextFixMigrationPath = new URL(
  '../../../../prisma/migrations/20260422193000_fix_study_search_text_backfill/migration.sql',
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

  it('keeps the searchText backfill fix-up migration that extracts semantic JSON scalar text', async () => {
    const migration = await readFile(searchTextFixMigrationPath, 'utf8');

    expect(migration).toContain('CREATE OR REPLACE FUNCTION study_json_scalar_text');
    expect(migration).toContain('study_json_scalar_text(COALESCE("rawFieldsJson"::jsonb');
    expect(migration).toContain('study_json_scalar_text(COALESCE("canonicalJson"::jsonb');
    expect(migration).toContain('study_json_scalar_text(COALESCE("promptJson"::jsonb');
    expect(migration).toContain('study_json_scalar_text(COALESCE("answerJson"::jsonb');
  });
});
