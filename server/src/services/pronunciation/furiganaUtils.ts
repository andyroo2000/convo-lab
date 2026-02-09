export interface FuriganaUnit {
  surface: string;
  reading: string;
}

function isHiragana(char: string): boolean {
  if (!char) return false;
  const code = char.charCodeAt(0);
  return code >= 0x3040 && code <= 0x309f;
}

function isKatakana(char: string): boolean {
  if (!char) return false;
  const code = char.charCodeAt(0);
  return code >= 0x30a0 && code <= 0x30ff;
}

function isKana(char: string): boolean {
  return isHiragana(char) || isKatakana(char);
}

function isPunctuation(char: string): boolean {
  return /[。、！？!?.,、。？！…「」『』（）()]/.test(char);
}

function stripFuriganaToKana(text: string): string {
  const output: string[] = [];
  let inBracket = false;

  for (const char of text) {
    if (char === '[') {
      inBracket = true;
      continue;
    }
    if (char === ']') {
      inBracket = false;
      continue;
    }

    if (inBracket) {
      output.push(char);
      continue;
    }

    if (isKana(char) || isPunctuation(char) || /\s/.test(char)) {
      output.push(char);
    }
  }

  return output.join('');
}

export function normalizeJapaneseReading(reading: string): string {
  const trimmed = reading.trim();
  if (!trimmed) return trimmed;
  if (trimmed.includes('[')) {
    return stripFuriganaToKana(trimmed);
  }
  return trimmed;
}

function splitSurfaceForReading(surface: string, reading: string): FuriganaUnit[] {
  const match = surface.match(/([\u4e00-\u9faf]+)$/);
  if (!match) {
    return [{ surface, reading: surface }];
  }

  const kanjiSegment = match[1];
  const prefix = surface.slice(0, surface.length - kanjiSegment.length);
  const units: FuriganaUnit[] = [];

  if (prefix) {
    units.push({ surface: prefix, reading: prefix });
  }

  units.push({ surface: kanjiSegment, reading });
  return units;
}

export function parseFuriganaUnits(furigana: string): FuriganaUnit[] {
  const units: FuriganaUnit[] = [];
  let buffer = '';
  let i = 0;

  while (i < furigana.length) {
    const char = furigana[i];
    if (char === '[') {
      const readingParts: string[] = [];
      i++;
      while (i < furigana.length && furigana[i] !== ']') {
        readingParts.push(furigana[i]);
        i++;
      }
      i++;

      if (buffer) {
        units.push(...splitSurfaceForReading(buffer, readingParts.join('')));
        buffer = '';
      }
      continue;
    }

    buffer += char;
    i++;
  }

  if (buffer) {
    units.push({ surface: buffer, reading: buffer });
  }

  return units;
}
