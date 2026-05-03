import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { indexKanjiumRows, parseKanjiumAccentText } from './kanjiumParser.js';
import type { KanjiumPitchCandidate } from './types.js';

let cachedIndex: Map<string, KanjiumPitchCandidate[]> | null = null;

function getDefaultKanjiumPath(): string {
  const currentFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(currentFile), '../../data/kanjium/accents.txt');
}

export async function loadKanjiumAccentIndex(
  accentsPath: string = getDefaultKanjiumPath()
): Promise<Map<string, KanjiumPitchCandidate[]>> {
  if (cachedIndex && accentsPath === getDefaultKanjiumPath()) {
    return cachedIndex;
  }

  const text = await readFile(accentsPath, 'utf8');
  const index = indexKanjiumRows(parseKanjiumAccentText(text));
  if (accentsPath === getDefaultKanjiumPath()) {
    cachedIndex = index;
  }

  return index;
}

export async function getKanjiumCandidates(expression: string): Promise<KanjiumPitchCandidate[]> {
  const index = await loadKanjiumAccentIndex();
  return index.get(expression) ?? [];
}
