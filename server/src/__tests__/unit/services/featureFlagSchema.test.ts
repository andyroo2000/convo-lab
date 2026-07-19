import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const schemaPath = new URL('../../../../prisma/schema.prisma', import.meta.url);
const removalMigrationPath = new URL(
  '../../../../prisma/migrations/20260719194500_drop_study_api_feature_flags/migration.sql',
  import.meta.url
);

const retiredColumns = [
  'studyApiEnabled',
  'studyApiSettings',
  'studyApiOverview',
  'studyApiBrowser',
  'studyApiBrowserDetail',
  'studyApiNewQueue',
  'studyApiImports',
  'studyApiSettingsWrite',
  'studyApiNewQueueWrite',
  'studyApiReview',
  'studyApiCardWrites',
  'studyApiCardDrafts',
  'studyApiMedia',
  'studyApiDailyAudio',
] as const;

describe('feature flag schema', () => {
  it('removes every retired Study rollout flag from Prisma', async () => {
    const schema = await readFile(schemaPath, 'utf8');

    for (const column of retiredColumns) {
      expect(schema).not.toContain(column);
    }
    expect(schema).toMatch(/^\s*flashcardsEnabled\s+Boolean\s+@default\(true\)$/m);
  });

  it('uses one forward-compatible Postgres migration to drop every retired column', async () => {
    const migration = await readFile(removalMigrationPath, 'utf8');
    const dropClauses = retiredColumns.map(
      (column, index) =>
        `  DROP COLUMN "${column}"${index === retiredColumns.length - 1 ? ';' : ','}`
    );

    expect(migration.trim()).toBe(['ALTER TABLE "feature_flags"', ...dropClauses].join('\n'));
  });
});
