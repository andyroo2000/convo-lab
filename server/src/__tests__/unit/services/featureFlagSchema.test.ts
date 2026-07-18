import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const schemaPath = new URL('../../../../prisma/schema.prisma', import.meta.url);
const cardWritesMigrationPath = new URL(
  '../../../../prisma/migrations/20260718143000_add_study_api_card_writes_feature_flag/migration.sql',
  import.meta.url
);

describe('feature flag schema', () => {
  it('keeps the Postgres-safe card-write flag migration aligned with Prisma', async () => {
    const [schema, migration] = await Promise.all([
      readFile(schemaPath, 'utf8'),
      readFile(cardWritesMigrationPath, 'utf8'),
    ]);

    expect(schema).toContain('studyApiCardWrites    Boolean  @default(false)');
    expect(migration.trim()).toBe(
      'ALTER TABLE "feature_flags"\n' +
        '  ADD COLUMN "studyApiCardWrites" BOOLEAN NOT NULL DEFAULT false;'
    );
  });
});
