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
const retiredStudyModels = [
  'StudySettings',
  'DailyAudioPractice',
  'DailyAudioPracticeTrack',
  'StudyImportJob',
  'StudyNote',
  'StudyCardDraft',
  'StudyVariantGroup',
  'StudyVariantSentence',
  'StudyCard',
  'StudyReviewLog',
] as const;
const ignoredUserRelations = [
  ['studyNotes', 'StudyNote[]'],
  ['studyCards', 'StudyCard[]'],
  ['studyReviewLogs', 'StudyReviewLog[]'],
  ['studyImportJobs', 'StudyImportJob[]'],
  ['studyCardDrafts', 'StudyCardDraft[]'],
  ['studyVariantGroups', 'StudyVariantGroup[]'],
  ['studyVariantSentences', 'StudyVariantSentence[]'],
  ['studySettings', 'StudySettings?'],
  ['dailyAudioPractices', 'DailyAudioPractice[]'],
] as const;

function modelBlock(schema: string, modelName: string): string {
  const match = new RegExp(`model ${modelName} \\{([\\s\\S]*?)\\n\\}`).exec(schema);
  expect(match, `${modelName} must remain represented in the Prisma schema`).not.toBeNull();
  return match?.[0] ?? '';
}

describe('study schema verification', () => {
  it('excludes Learning OS-owned models from Prisma Client without dropping their schema history', async () => {
    const schema = await readFile(schemaPath, 'utf8');

    for (const modelName of retiredStudyModels) {
      expect(modelBlock(schema, modelName)).toContain('@@ignore');
    }

    const user = modelBlock(schema, 'User');
    for (const [relationName, relationType] of ignoredUserRelations) {
      const escapedType = relationType.replace(/[?[\]]/g, '\\$&');
      expect(user).toMatch(new RegExp(`${relationName}\\s+${escapedType}\\s+@ignore`));
    }
    expect(user).toMatch(/studyMedia\s+StudyMedia\[\]/);
    expect(user).not.toMatch(/studyMedia\s+StudyMedia\[\]\s+@ignore/);
  });

  it('keeps StudyMedia active for Audio Script while ignoring retired Study relations', async () => {
    const schema = await readFile(schemaPath, 'utf8');
    const studyMedia = modelBlock(schema, 'StudyMedia');

    expect(studyMedia).not.toContain('@@ignore');
    expect(studyMedia).toMatch(/importJob\s+StudyImportJob\?.+@ignore/);
    expect(studyMedia).toMatch(/promptAudioCards\s+StudyCard\[\].+@ignore/);
    expect(studyMedia).toMatch(/answerAudioCards\s+StudyCard\[\].+@ignore/);
    expect(studyMedia).toMatch(/imageCards\s+StudyCard\[\].+@ignore/);
    expect(studyMedia).toMatch(/audioScriptSegments\s+AudioScriptSegment\[\]/);
  });

  it('keeps the StudyCard(noteId) index in migration history', async () => {
    const migration = await readFile(migrationPath, 'utf8');

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
    const migration = await readFile(studyCardTypeCheckMigrationPath, 'utf8');

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
