import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { indexKanjiumRows, parseKanjiumAccentText } from './kanjiumParser.js';
import type { KanjiumPitchCandidate } from './types.js';

export interface KanjiumAccentStore {
  getCandidates(expression: string): Promise<KanjiumPitchCandidate[]>;
  loadIndex(): Promise<Map<string, KanjiumPitchCandidate[]>>;
}

function getDefaultKanjiumPath(): string {
  const currentFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(currentFile), '../../data/kanjium/accents.txt');
}

export function createKanjiumAccentStore(
  accentsPath: string = getDefaultKanjiumPath()
): KanjiumAccentStore {
  let indexPromise: Promise<Map<string, KanjiumPitchCandidate[]>> | null = null;

  const loadIndex = async (): Promise<Map<string, KanjiumPitchCandidate[]>> => {
    indexPromise ??= readFile(accentsPath, 'utf8')
      .then((text) => indexKanjiumRows(parseKanjiumAccentText(text)))
      .catch((error) => {
        indexPromise = null;
        throw error;
      });

    return indexPromise;
  };

  return {
    loadIndex,
    async getCandidates(expression: string): Promise<KanjiumPitchCandidate[]> {
      const index = await loadIndex();
      return index.get(expression) ?? [];
    },
  };
}

export const defaultKanjiumAccentStore = createKanjiumAccentStore();

export function warmKanjiumAccentIndex(): Promise<Map<string, KanjiumPitchCandidate[]>> {
  return defaultKanjiumAccentStore.loadIndex();
}

export async function getKanjiumCandidates(expression: string): Promise<KanjiumPitchCandidate[]> {
  return defaultKanjiumAccentStore.getCandidates(expression);
}
