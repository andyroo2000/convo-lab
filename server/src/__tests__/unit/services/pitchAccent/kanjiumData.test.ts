import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createKanjiumAccentStore } from '../../../../services/pitchAccent/kanjiumData.js';

describe('kanjiumData', () => {
  it('creates isolated stores with factory-scoped async caches', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'kanjium-data-'));
    const firstPath = path.join(dir, 'first.txt');
    const secondPath = path.join(dir, 'second.txt');
    await Promise.all([
      writeFile(firstPath, '会社\tかいしゃ\t0\n', 'utf8'),
      writeFile(secondPath, '上手\tじょうず\t3\n', 'utf8'),
    ]);

    const firstStore = createKanjiumAccentStore(firstPath);
    const secondStore = createKanjiumAccentStore(secondPath);

    await expect(firstStore.getCandidates('会社')).resolves.toEqual([
      { surface: '会社', reading: 'かいしゃ', pitchNum: 0 },
    ]);
    await expect(firstStore.getCandidates('上手')).resolves.toEqual([]);
    await expect(secondStore.getCandidates('上手')).resolves.toEqual([
      { surface: '上手', reading: 'じょうず', pitchNum: 3 },
    ]);
  });
});
