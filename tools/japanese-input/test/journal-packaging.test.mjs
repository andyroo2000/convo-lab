import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import {
  verifyArchive,
  scopeRuntimeSource,
  verifyRewriteCoverage,
  replaceExpected,
} from '../journal/packaging.mjs';

test('rejects a corrupted archive before extraction', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'journal-archive-test-'));
  const path = join(directory, 'bundle');
  try {
    await writeFile(path, 'verified bytes');
    const digest = createHash('sha256').update('verified bytes').digest('hex');
    await verifyArchive(path, digest);
    await writeFile(path, 'corrupted bytes');
    await assert.rejects(verifyArchive(path, digest), /checksum does not match/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('scopes all runtime roots and rejects missing rewrite coverage', () => {
  const seen = new Set();
  const roots = ['browser', 'vendor', 'assets', 'gpu'];
  const input = roots.map((root) => `'/${root}/file.mjs'`).join(';');
  const output = scopeRuntimeSource(input, '/japanese-input/v1', seen);
  for (const root of roots) assert.ok(output.includes(`/japanese-input/v1/${root}/`));
  assert.throws(() => verifyRewriteCoverage(seen), /contract, engine-transport/);
  assert.equal(
    scopeRuntimeSource("'/contract.mjs';'/engine-transport.mjs'", '/japanese-input/v1', seen),
    "'/japanese-input/v1/contract.mjs';'/japanese-input/v1/web/engine-transport.mjs'"
  );
  verifyRewriteCoverage(seen);
});

test('fails loudly when a required source patch drifts', () => {
  assert.equal(replaceExpected('import old;', 'old', 'new'), 'import new;');
  assert.throws(() => replaceExpected('import changed;', 'old', 'new'), /no longer contains/);
});
