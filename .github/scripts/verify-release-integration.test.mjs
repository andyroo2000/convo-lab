import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { verifyReleaseIntegration } from './verify-release-integration.mjs';

const commit = 'a'.repeat(40);
const checksum = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function fixtureTree() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'release-integration-'));
  const directories = Object.fromEntries(
    await Promise.all(
      ['provider', 'web', 'ios'].map(async (name) => {
        const directory = path.join(root, name);
        await mkdir(directory);
        return [name, directory];
      })
    )
  );
  const payload = Buffer.from('{"contract":"ok"}\n');
  const payloadSha = checksum(payload);
  const manifest = Buffer.from(
    `${JSON.stringify({
      schemaVersion: 1,
      fixtures: [
        {
          id: 'example-v1',
          path: 'tests/Fixtures/Compatibility/example-v1.json',
          checksumPath: 'tests/Fixtures/Compatibility/example-v1.sha256',
          sha256: payloadSha,
        },
      ],
    })}\n`
  );
  const files = {
    'manifest-v1.json': manifest,
    'manifest-v1.sha256': Buffer.from(`${checksum(manifest)}  manifest-v1.json\n`),
    'example-v1.json': payload,
    'example-v1.sha256': Buffer.from(`${payloadSha}  example-v1.json\n`),
  };
  await Promise.all(
    Object.values(directories).flatMap((directory) =>
      Object.entries(files).map(([name, bytes]) => writeFile(path.join(directory, name), bytes))
    )
  );
  const pinsFile = path.join(root, 'components.json');
  await writeFile(
    pinsFile,
    JSON.stringify({
      schemaVersion: 1,
      components: Object.fromEntries(
        ['provider', 'web', 'ios'].map((name) => [
          name,
          { repository: `example/${name}`, sha: commit },
        ])
      ),
    })
  );
  return { directories, pinsFile };
}

test('accepts byte-identical provider, web, and iOS fixtures at full SHA pins', async () => {
  const { directories, pinsFile } = await fixtureTree();
  const result = await verifyReleaseIntegration({
    pinsFile,
    providerDirectory: directories.provider,
    webDirectory: directories.web,
    iosDirectory: directories.ios,
  });
  assert.equal(result.fixtureCount, 4);
});

test('rejects consumer drift and abbreviated component pins', async () => {
  const drift = await fixtureTree();
  await writeFile(path.join(drift.directories.ios, 'example-v1.json'), '{"drift":true}\n');
  await assert.rejects(
    verifyReleaseIntegration({
      pinsFile: drift.pinsFile,
      providerDirectory: drift.directories.provider,
      webDirectory: drift.directories.web,
      iosDirectory: drift.directories.ios,
    }),
    /ios fixture differs from provider bytes/u
  );

  const abbreviated = await fixtureTree();
  const pins = JSON.parse(await readFile(abbreviated.pinsFile, 'utf8'));
  pins.components.web.sha = 'abc123';
  await writeFile(abbreviated.pinsFile, JSON.stringify(pins));
  await assert.rejects(
    verifyReleaseIntegration({
      pinsFile: abbreviated.pinsFile,
      providerDirectory: abbreviated.directories.provider,
      webDirectory: abbreviated.directories.web,
      iosDirectory: abbreviated.directories.ios,
    }),
    /web component must be pinned to a full commit SHA/u
  );
});
