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

function isKanji(char: string): boolean {
  if (!char) return false;
  const code = char.charCodeAt(0);
  return code >= 0x4e00 && code <= 0x9fff;
}

export function stripFuriganaToKana(text: string): string {
  const output: string[] = [];
  let buffer: string[] = []; // accumulates non-bracket characters

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '[') {
      // The bracket reading replaces the surface text in the buffer.
      // Find the leftmost kanji in the buffer — everything from there
      // to the end is the annotated surface (discard it).
      let firstKanjiIdx = buffer.length;
      for (let j = 0; j < buffer.length; j++) {
        if (isKanji(buffer[j])) {
          firstKanjiIdx = j;
          break;
        }
      }

      // Read the bracket content (the correct reading)
      const reading: string[] = [];
      i++;
      while (i < text.length && text[i] !== ']') {
        reading.push(text[i]);
        i++;
      }
      // i now points at ']', the for-loop will increment past it

      // Check if a suffix of the kana prefix is already included in the reading.
      // e.g. にはお菓子[おかし] — prefix "にはお", reading "おかし", kanji surface "菓子"
      // The suffix "お" matches the reading start, and the remaining reading "かし" (len 2)
      // covers the kanji surface "菓子" (len 2), so "お" is part of the annotated surface.
      // But for か買[か] — prefix "か", reading "か", kanji "買" — remaining reading ""
      // is shorter than kanji surface, so "か" is a standalone particle.
      const prefix = buffer.slice(0, firstKanjiIdx);
      const readingStr = reading.join('');
      const kanjiSurfaceLen = buffer.length - firstKanjiIdx;
      let prefixCharsConsumed = 0;

      if (prefix.length > 0) {
        // Try longest matching suffix of prefix against start of reading
        for (let suffixLen = prefix.length; suffixLen >= 1; suffixLen--) {
          const suffix = prefix.slice(prefix.length - suffixLen).join('');
          if (readingStr.startsWith(suffix)) {
            const remainingReading = readingStr.length - suffixLen;
            if (remainingReading >= kanjiSurfaceLen) {
              prefixCharsConsumed = suffixLen;
              break;
            }
          }
        }
      }

      // Flush the prefix, minus any characters consumed by the reading
      for (let j = 0; j < firstKanjiIdx - prefixCharsConsumed; j++) {
        output.push(buffer[j]);
      }

      output.push(readingStr);
      buffer = [];
      continue;
    }

    buffer.push(char);
  }

  // Flush remaining buffer (text not followed by a bracket)
  for (const char of buffer) {
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
