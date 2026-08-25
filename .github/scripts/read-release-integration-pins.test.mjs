import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  githubOutputLines,
  readReleaseIntegrationPins,
} from './read-release-integration-pins.mjs';

const fullSha = 'a'.repeat(40);

async function pinsFile(overrides = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'integration-pins-'));
  const file = path.join(directory, 'components.json');
  await writeFile(
    file,
    JSON.stringify({
      schemaVersion: 1,
      components: Object.fromEntries(
        ['provider', 'web', 'ios'].map((name) => [
          name,
          {
            repository: `example/${name}`,
            sha: fullSha,
            fixtureDirectory: `fixtures/${name}`,
            ...overrides[name],
          },
        ])
      ),
    })
  );
  return file;
}

test('emits validated exact pins and safe fixture directories as GitHub outputs', async () => {
  const outputs = await readReleaseIntegrationPins(
    await pinsFile(),
    'integration/compatibility-123-2'
  );
  assert.equal(outputs.provider_sha, fullSha);
  assert.equal(outputs.ios_fixture_directory, 'fixtures/ios');
  assert.match(githubOutputLines(outputs), /^branch=integration\/compatibility-123-2$/mu);
  assert.throws(
    () => githubOutputLines({ provider_sha: `${fullSha}\nbranch=injected` }),
    /single-line safe/u
  );
});

test('rejects abbreviated SHAs, traversal paths, repositories, and branch injection', async () => {
  await assert.rejects(
    readReleaseIntegrationPins(
      await pinsFile({ web: { sha: 'abc123' } }),
      'integration/compatibility-123-1'
    ),
    /web must use a full immutable commit SHA/u
  );
  await assert.rejects(
    readReleaseIntegrationPins(
      await pinsFile({ ios: { fixtureDirectory: '../outside' } }),
      'integration/compatibility-123-1'
    ),
    /safe repository-relative fixture directory/u
  );
  for (const fixtureDirectory of [
    'fixtures/web\nweb_sha=deadbeef',
    'fixtures/web"; echo injected',
    'fixtures/$(echo injected)',
  ]) {
    await assert.rejects(
      readReleaseIntegrationPins(
        await pinsFile({ web: { fixtureDirectory } }),
        'integration/compatibility-123-1'
      ),
      /safe repository-relative fixture directory/u
    );
  }
  await assert.rejects(
    readReleaseIntegrationPins(
      await pinsFile({ provider: { repository: 'invalid\nrepository' } }),
      'integration/compatibility-123-1'
    ),
    /owner\/repository/u
  );
  await assert.rejects(
    readReleaseIntegrationPins(await pinsFile(), 'integration/compatibility-123-1\nwrite=true'),
    /numeric run and attempt identifiers/u
  );
});
