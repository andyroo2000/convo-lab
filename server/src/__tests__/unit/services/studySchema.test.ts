import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const schemaPath = new URL('../../../../prisma/schema.prisma', import.meta.url);
const migrationPath = new URL(
  '../../../../prisma/migrations/20260412123600_add_study_subsystem/migration.sql',
  import.meta.url
);
const hardenStudyCardStateMigrationPath = new URL(
  '../../../../prisma/migrations/20260422113000_harden_study_card_state/migration.sql',
  import.meta.url
);
const searchTextFixMigrationPath = new URL(
  '../../../../prisma/migrations/20260422193000_fix_study_search_text_backfill/migration.sql',
  import.meta.url
);
const studySearchAndExportIndexesMigrationPath = new URL(
  '../../../../prisma/migrations/20260421233000_add_study_search_text_and_export_indexes/migration.sql',
  import.meta.url
);
const studyCardTypeCheckMigrationPath = new URL(
  '../../../../prisma/migrations/20260422213000_add_study_card_type_check/migration.sql',
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
    expect(migration).toContain('WITH RECURSIVE walk(value) AS (');
    expect(migration).toContain('FROM walk;');
    expect(migration).toMatch(/\)\s+FROM walk;/);
    expect(migration).toContain('study_json_scalar_text(COALESCE("rawFieldsJson"::jsonb');
    expect(migration).toContain('study_json_scalar_text(COALESCE("canonicalJson"::jsonb');
    expect(migration).toContain('study_json_scalar_text(COALESCE("promptJson"::jsonb');
    expect(migration).toContain('study_json_scalar_text(COALESCE("answerJson"::jsonb');
    expect(migration).toContain('WHERE "searchText" IS NOT NULL');
  });

  it('keeps the partial unique active-processing study import lock in migration history', async () => {
    const migration = await readFile(studySearchAndExportIndexesMigrationPath, 'utf8');

    expect(migration).toContain('CREATE UNIQUE INDEX "study_import_jobs_userId_processing_unique"');
    expect(migration).toContain('ON "study_import_jobs"("userId")');
    expect(migration).toContain('WHERE "status" = \'processing\'');
  });

  it('keeps the scheduler-state hardening migration that backfills legacy rows and enforces queue-state validity', async () => {
    const migration = await readFile(hardenStudyCardStateMigrationPath, 'utf8');

    expect(migration).toContain('WHERE "schedulerStateJson" IS NULL;');
    expect(migration).toContain('ALTER COLUMN "schedulerStateJson" SET NOT NULL;');
    expect(migration).toContain('ADD CONSTRAINT "study_cards_queue_state_check"');
    expect(migration).toContain('COALESCE("dueAt", now())');
    expect(migration).toContain('CASE "queueState"');
  });

  it('keeps the StudyCard cardType check constraint migration', async () => {
    const [schema, migration] = await Promise.all([
      readFile(schemaPath, 'utf8'),
      readFile(studyCardTypeCheckMigrationPath, 'utf8'),
    ]);

    expect(schema).toContain(
      'cardType             String // recognition | production | cloze; DB check enforced in migration history.'
    );
    expect(migration).toContain('ADD CONSTRAINT "study_cards_card_type_check"');
    expect(migration).toContain('"cardType" IN (');
    expect(migration).toContain("'recognition'");
    expect(migration).toContain("'production'");
    expect(migration).toContain("'cloze'");
  });

  it('documents nullable sourceReviewId uniqueness as intentional for imported revlogs only', async () => {
    const schema = await readFile(schemaPath, 'utf8');

    expect(schema).toContain(
      'sourceReviewId     BigInt? // Nullable for ConvoLab-native logs; unique per user when imported review ids are present.'
    );
    expect(schema).toContain('@@unique([userId, sourceReviewId])');
  });
});
