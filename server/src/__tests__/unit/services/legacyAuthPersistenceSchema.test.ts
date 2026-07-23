import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const schemaPath = new URL('../../../../prisma/schema.prisma', import.meta.url);
const migrationPath = new URL(
  '../../../../prisma/migrations/20260723024500_contract_legacy_auth_persistence/migration.sql',
  import.meta.url
);

const retiredTables = [
  'oauth_accounts',
  'email_verification_tokens',
  'password_reset_tokens',
] as const;

describe('legacy auth persistence schema', () => {
  it('keeps credentials, auth tokens, and OAuth identities out of ConvoLab Prisma', async () => {
    const schema = await readFile(schemaPath, 'utf8');
    const userModel = schema.slice(
      schema.indexOf('model User {'),
      schema.indexOf('model StudySettings')
    );

    expect(userModel).not.toMatch(/^\s*(?:password|googleId)\s+/m);
    expect(userModel).not.toMatch(
      /^\s*(?:oauthAccounts|emailVerificationTokens|passwordResetTokens)\s+/m
    );
    expect(schema).not.toContain('model OAuthAccount {');
    expect(schema).not.toContain('model EmailVerificationToken {');
    expect(schema).not.toContain('model PasswordResetToken {');
  });

  it('uses an atomic, retryable Postgres contract migration', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toMatch(/\bBEGIN;/);
    expect(migration.trimEnd().endsWith('COMMIT;')).toBe(true);
    for (const table of retiredTables) {
      expect(migration).toContain(`DROP TABLE IF EXISTS "${table}";`);
    }
    expect(migration).toContain('DROP COLUMN IF EXISTS "password"');
    expect(migration).toContain('DROP COLUMN IF EXISTS "googleId"');
    expect(migration).not.toMatch(/\bCASCADE\b/);
  });

  it('drops dependent token tables before contracting the projected user row', async () => {
    const migration = await readFile(migrationPath, 'utf8');
    const userAlter = migration.indexOf('ALTER TABLE "User"');

    expect(userAlter).toBeGreaterThanOrEqual(0);
    for (const table of retiredTables) {
      expect(migration.indexOf(`DROP TABLE IF EXISTS "${table}"`)).toBeLessThan(userAlter);
    }
  });
});
