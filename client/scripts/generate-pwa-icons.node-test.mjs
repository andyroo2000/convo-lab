import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import sharp from 'sharp';

import { generateIcons, PWA_ICON_SPECS } from './generate-pwa-icons.js';

const sourcePath = fileURLToPath(new URL('../public/favicon.svg', import.meta.url));

test('declares every PWA icon output used by the client', () => {
  assert.deepEqual(PWA_ICON_SPECS, [
    { size: 192, name: 'pwa-192x192.png' },
    { size: 512, name: 'pwa-512x512.png' },
    { size: 180, name: 'apple-touch-icon.png' },
  ]);
});

test('renders the SVG source as correctly sized metadata-free RGBA PNG icons', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'convolab-pwa-icons-'));

  try {
    await generateIcons({ sourcePath, outputDir, log: () => {} });

    for (const { size, name } of PWA_ICON_SPECS) {
      const outputPath = join(outputDir, name);
      const output = await readFile(outputPath);
      const metadata = await sharp(output).metadata();

      assert.equal(metadata.format, 'png');
      assert.equal(metadata.width, size);
      assert.equal(metadata.height, size);
      assert.equal(metadata.channels, 4);
      assert.equal(metadata.hasAlpha, true);
      assert.equal(metadata.orientation, undefined);
      assert.equal(metadata.exif, undefined);
      assert.equal(metadata.icc, undefined);
      assert.equal(metadata.xmp, undefined);

      const { data, info } = await sharp(output).raw().toBuffer({ resolveWithObject: true });
      const pixelAt = (x, y) => {
        const offset = (y * info.width + x) * info.channels;
        return [...data.subarray(offset, offset + info.channels)];
      };

      assert.deepEqual(pixelAt(0, 0), [0, 0, 0, 0]);
      assert.deepEqual(pixelAt(Math.floor(size / 2), Math.floor((size * 3) / 4)), [94, 106, 216, 255]);
    }
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});
