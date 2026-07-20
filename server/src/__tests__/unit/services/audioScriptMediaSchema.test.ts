import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const schemaPath = new URL('../../../../prisma/schema.prisma', import.meta.url);
const migrationPath = new URL(
  '../../../../prisma/migrations/20260719230000_extract_audio_script_media/migration.sql',
  import.meta.url
);
const contractMigrationPath = new URL(
  '../../../../prisma/migrations/20260720031500_drop_legacy_audio_script_media_reference/migration.sql',
  import.meta.url
);

describe('audio script media schema', () => {
  it('maps the public image relation only to Audio Script-owned media', async () => {
    const schema = await readFile(schemaPath, 'utf8');

    expect(schema).toContain('model AudioScriptMedia {');
    expect(schema).toContain('imageMediaId      String?   @map("audioScriptMediaId")');
    expect(schema).not.toContain('legacyImageMediaId');
    expect(schema).not.toContain('legacyImageMedia StudyMedia?');
  });

  it('uses a Postgres-safe expand migration that backfills before adding the new foreign key', async () => {
    const migration = await readFile(migrationPath, 'utf8');
    const createTableIndex = migration.indexOf('CREATE TABLE IF NOT EXISTS "audio_script_media"');
    const addColumnIndex = migration.indexOf('ADD COLUMN IF NOT EXISTS "audioScriptMediaId" TEXT');
    const backfillMediaIndex = migration.indexOf('INSERT INTO "audio_script_media"');
    const backfillRelationIndex = migration.indexOf('SET "audioScriptMediaId" = "imageMediaId"');
    const foreignKeyIndex = migration.indexOf(
      'ADD CONSTRAINT "audio_script_segments_audioScriptMediaId_fkey"'
    );

    expect(createTableIndex).toBeGreaterThanOrEqual(0);
    expect(addColumnIndex).toBeGreaterThan(createTableIndex);
    expect(backfillMediaIndex).toBeGreaterThan(addColumnIndex);
    expect(backfillRelationIndex).toBeGreaterThan(backfillMediaIndex);
    expect(foreignKeyIndex).toBeGreaterThan(backfillRelationIndex);
    expect(migration).toContain('WHERE segment."imageMediaId" = media."id"');
    expect(migration).toContain('FOREIGN KEY ("userId") REFERENCES "User"("id")');
    expect(migration).not.toContain('REFERENCES "users"');
    expect(migration).not.toMatch(/DROP (?:COLUMN|TABLE|CONSTRAINT)/);
  });

  it('is atomic and retryable after a partially applied Postgres migration', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration.trimStart().indexOf('BEGIN;')).toBeGreaterThanOrEqual(0);
    expect(migration.trimEnd().endsWith('COMMIT;')).toBe(true);
    expect(migration).toContain('ON CONFLICT ("id") DO NOTHING');
    expect(migration.match(/CREATE INDEX IF NOT EXISTS/g)).toHaveLength(3);
    expect(migration.match(/FROM pg_constraint/g)).toHaveLength(2);
  });

  it('keeps index and constraint names within the Postgres identifier limit', async () => {
    const migration = await readFile(migrationPath, 'utf8');
    const identifiers = [...migration.matchAll(/(?:INDEX|CONSTRAINT) "([^"]+)"/g)].map(
      (match) => match[1]
    );

    expect(identifiers.length).toBeGreaterThan(0);
    expect(identifiers.every((identifier) => Buffer.byteLength(identifier) <= 63)).toBe(true);
  });

  it('contracts the legacy relation only after verifying its backfill', async () => {
    const migration = await readFile(contractMigrationPath, 'utf8');
    const guardIndex = migration.indexOf('"imageMediaId" IS NOT NULL');
    const constraintIndex = migration.indexOf(
      'DROP CONSTRAINT IF EXISTS "audio_script_segments_imageMediaId_fkey"'
    );
    const indexIndex = migration.indexOf(
      'DROP INDEX IF EXISTS "audio_script_segments_imageMediaId_idx"'
    );
    const columnIndex = migration.indexOf('DROP COLUMN IF EXISTS "imageMediaId"');

    expect(migration.trimStart().indexOf('BEGIN;')).toBeGreaterThanOrEqual(0);
    expect(migration.trimEnd().endsWith('COMMIT;')).toBe(true);
    expect(guardIndex).toBeGreaterThanOrEqual(0);
    expect(migration).toContain('"audioScriptMediaId" IS NULL');
    expect(migration).not.toContain('"imageMediaId" <> "audioScriptMediaId"');
    expect(constraintIndex).toBeGreaterThan(guardIndex);
    expect(indexIndex).toBeGreaterThan(constraintIndex);
    expect(columnIndex).toBeGreaterThan(indexIndex);
    expect(migration).not.toMatch(/DROP TABLE\s+"?study_media"?/i);
  });
});
