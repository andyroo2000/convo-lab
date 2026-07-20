import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const schemaPath = new URL('../../../../prisma/schema.prisma', import.meta.url);
const migrationPath = new URL(
  '../../../../prisma/migrations/20260719230000_extract_audio_script_media/migration.sql',
  import.meta.url
);

describe('audio script media schema', () => {
  it('maps the public image relation to the new column while retaining the rollback column', async () => {
    const schema = await readFile(schemaPath, 'utf8');

    expect(schema).toContain('model AudioScriptMedia {');
    expect(schema).toContain('imageMediaId       String?   @map("audioScriptMediaId")');
    expect(schema).toContain('legacyImageMediaId String?   @map("imageMediaId")');
    expect(schema).toContain(
      'legacyImageMedia StudyMedia?       @relation("AudioScriptSegmentLegacyImage"'
    );
  });

  it('uses a Postgres-safe expand migration that backfills before adding the new foreign key', async () => {
    const migration = await readFile(migrationPath, 'utf8');
    const createTableIndex = migration.indexOf('CREATE TABLE "audio_script_media"');
    const addColumnIndex = migration.indexOf('ADD COLUMN "audioScriptMediaId" TEXT');
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
    expect(migration).not.toMatch(/DROP (?:COLUMN|TABLE|CONSTRAINT)/);
  });

  it('keeps index and constraint names within the Postgres identifier limit', async () => {
    const migration = await readFile(migrationPath, 'utf8');
    const identifiers = [...migration.matchAll(/(?:INDEX|CONSTRAINT) "([^"]+)"/g)].map(
      (match) => match[1]
    );

    expect(identifiers.length).toBeGreaterThan(0);
    expect(identifiers.every((identifier) => Buffer.byteLength(identifier) <= 63)).toBe(true);
  });
});
