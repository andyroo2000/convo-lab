import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { exportStudyMedia } from './export-convolab-study-media.mjs';

async function withTemporaryDirectory(callback) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'convolab-media-export-'));

  try {
    await callback(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function fakeBucket(objects) {
  return {
    name: 'test-bucket',
    file(storagePath) {
      return {
        async download({ destination }) {
          const object = objects.get(storagePath);

          if (object instanceof Error) {
            throw object;
          }

          await mkdir(path.dirname(destination), { recursive: true });
          await writeFile(destination, object);
        },
      };
    },
  };
}

test('exports valid media and records missing GCS objects', async () => {
  await withTemporaryDirectory(async (directory) => {
    const manifestPath = path.join(directory, 'manifest.json');
    const missingManifestPath = path.join(directory, 'missing.json');
    const outputRoot = path.join(directory, 'files');
    const missingError = Object.assign(new Error('No such object'), { code: 404 });

    await writeFile(
      manifestPath,
      JSON.stringify([
        'study-media/user/missing.mp3',
        'study-media/user/present.mp3',
      ])
    );

    const result = await exportStudyMedia({
      bucket: fakeBucket(
        new Map([
          ['study-media/user/missing.mp3', missingError],
          ['study-media/user/present.mp3', 'present-bytes'],
        ])
      ),
      manifestPath,
      missingManifestPath,
      outputRoot,
      concurrency: 2,
    });

    assert.equal(result.files, 1);
    assert.equal(result.missingFiles, 1);
    assert.deepEqual(JSON.parse(await readFile(missingManifestPath, 'utf8')), [
      'study-media/user/missing.mp3',
    ]);
    assert.equal(
      await readFile(path.join(outputRoot, 'study-media/user/present.mp3'), 'utf8'),
      'present-bytes'
    );
    assert.equal((await stat(outputRoot)).mode & 0o777, 0o755);
    assert.equal((await stat(path.join(outputRoot, 'study-media/user'))).mode & 0o777, 0o755);
    assert.equal(
      (await stat(path.join(outputRoot, 'study-media/user/present.mp3'))).mode & 0o777,
      0o644
    );
  });
});

test('keeps non-404 storage failures blocking', async () => {
  await withTemporaryDirectory(async (directory) => {
    const manifestPath = path.join(directory, 'manifest.json');
    const outputRoot = path.join(directory, 'files');
    const permissionError = Object.assign(new Error('Access denied'), { code: 403 });

    await writeFile(manifestPath, JSON.stringify(['study-media/user/private.mp3']));

    await assert.rejects(
      exportStudyMedia({
        bucket: fakeBucket(
          new Map([['study-media/user/private.mp3', permissionError]])
        ),
        manifestPath,
        outputRoot,
      }),
      /Access denied/
    );
  });
});
