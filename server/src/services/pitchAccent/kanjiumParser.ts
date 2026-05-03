import type { KanjiumAccentRow, KanjiumPitchCandidate } from './types.js';

export function parseKanjiumAccentLine(line: string): KanjiumAccentRow | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  const [surface, reading, rawPitchNums] = trimmed.split('\t');
  if (!surface || !reading || !rawPitchNums) return null;

  const pitchNums = rawPitchNums
    .split(',')
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isSafeInteger(value) && value >= 0);

  if (pitchNums.length === 0) return null;

  return {
    surface,
    reading,
    pitchNums,
  };
}

export function parseKanjiumAccentText(text: string): KanjiumAccentRow[] {
  return text
    .split(/\r?\n/)
    .map((line) => parseKanjiumAccentLine(line))
    .filter((row): row is KanjiumAccentRow => Boolean(row));
}

export function indexKanjiumRows(rows: KanjiumAccentRow[]): Map<string, KanjiumPitchCandidate[]> {
  const index = new Map<string, KanjiumPitchCandidate[]>();

  for (const row of rows) {
    const candidates = index.get(row.surface) ?? [];
    for (const pitchNum of row.pitchNums) {
      candidates.push({
        surface: row.surface,
        reading: row.reading,
        pitchNum,
      });
    }
    index.set(row.surface, candidates);
  }

  return index;
}
