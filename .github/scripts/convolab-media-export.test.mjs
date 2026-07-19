import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  exportStudyMedia,
  parsePositiveInteger,
  resolveExportPath,
  validateStoragePaths,
} from '../../server/scripts/export-convolab-study-media.mjs';

test('normalizes, sorts, and deduplicates safe study media paths', () => {
  assert.deepEqual(
    validateStoragePaths([
      'study-media/user-2/image.webp',
      'study-media/user-1/audio.mp3',
      'study-media/user-2/image.webp',
    ]),
    ['study-media/user-1/audio.mp3', 'study-media/user-2/image.webp']
  );
});

test('rejects unsafe or malformed manifest entries', () => {
  for (const manifest of [
    {},
    [null],
    [''],
    ['/study-media/file.mp3'],
    ['study-media/../secret'],
    ['study-media//file.mp3'],
    ['study-media\\file.mp3'],
    ['other-prefix/file.mp3'],
  ]) {
    assert.throws(() => validateStoragePaths(manifest));
  }
});

test('validates concurrency and keeps resolved paths inside the export root', () => {
  assert.equal(parsePositiveInteger('8', 'concurrency', 32), 8);
  assert.throws(() => parsePositiveInteger('0', 'concurrency', 32));
  assert.throws(() => parsePositiveInteger('8workers', 'concurrency', 32));
  assert.throws(() => parsePositiveInteger('33', 'concurrency', 32));

  const root = path.resolve('/tmp/convolab-media-export');
  assert.equal(
    resolveExportPath(root, 'study-media/user/file.mp3'),
    path.join(root, 'study-media/user/file.mp3')
  );
});

test('exports manifest objects with bounded concurrency and byte accounting', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'convolab-media-export-'));
  const manifestPath = path.join(directory, 'manifest.json');
  const outputRoot = path.join(directory, 'files');
  const activeDownloads = { current: 0, maximum: 0 };
  const objects = new Map([
    ['study-media/user/audio.mp3', Buffer.from('audio')],
    ['study-media/user/image.webp', Buffer.from('image-data')],
  ]);
  const bucket = {
    name: 'test-bucket',
    file(storagePath) {
      return {
        async download({ destination, validation }) {
          assert.equal(validation, 'crc32c');
          activeDownloads.current += 1;
          activeDownloads.maximum = Math.max(
            activeDownloads.maximum,
            activeDownloads.current
          );
          await new Promise((resolve) => setTimeout(resolve, 10));
          const contents = objects.get(storagePath);

          if (!contents) {
            throw new Error(`Missing object: ${storagePath}`);
          }

          await writeFile(destination, contents);
          activeDownloads.current -= 1;
        },
      };
    },
  };

  try {
    await writeFile(manifestPath, JSON.stringify([...objects.keys()]));
    const result = await exportStudyMedia({
      bucket,
      manifestPath,
      outputRoot,
      concurrency: 2,
    });

    assert.deepEqual(result, {
      bucket: 'test-bucket',
      files: 2,
      bytes: 15,
      outputRoot: await realpath(outputRoot),
    });
    assert.equal(activeDownloads.maximum, 2);
    assert.equal(
      await readFile(path.join(outputRoot, 'study-media/user/audio.mp3'), 'utf8'),
      'audio'
    );
    assert.equal(
      await readFile(path.join(outputRoot, 'study-media/user/image.webp'), 'utf8'),
      'image-data'
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('accepts an empty manifest as a successful no-op export', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'convolab-media-export-empty-'));
  const manifestPath = path.join(directory, 'manifest.json');
  const outputRoot = path.join(directory, 'files');

  try {
    await writeFile(manifestPath, '[]');
    const result = await exportStudyMedia({
      bucket: { name: 'test-bucket' },
      manifestPath,
      outputRoot,
    });

    assert.equal(result.files, 0);
    assert.equal(result.bytes, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('removes partial files after a failed download and refuses a nonempty root', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'convolab-media-export-failure-'));
  const manifestPath = path.join(directory, 'manifest.json');
  const outputRoot = path.join(directory, 'files');

  try {
    await writeFile(manifestPath, JSON.stringify(['study-media/user/missing.mp3']));

    await assert.rejects(
      exportStudyMedia({
        bucket: {
          name: 'test-bucket',
          file() {
            return {
              async download({ destination }) {
                await writeFile(destination, 'partial');
                throw new Error('download failed');
              },
            };
          },
        },
        manifestPath,
        outputRoot,
      }),
      /download failed/
    );
    await assert.rejects(
      readFile(path.join(outputRoot, 'study-media/user/missing.mp3.partial')),
      /ENOENT/
    );

    await mkdir(outputRoot, { recursive: true });
    await writeFile(path.join(outputRoot, 'unexpected'), 'occupied');
    await assert.rejects(
      exportStudyMedia({
        bucket: { name: 'test-bucket' },
        manifestPath,
        outputRoot,
      }),
      /Export root must be empty/
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
