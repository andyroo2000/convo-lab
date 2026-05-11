import { logger } from '../logger.js';

import {
  ensureDictionaryLoadedSync,
  getDictionaryCache,
  normalizeMatchText,
} from './dictionaryStore.js';
import { normalizeJapaneseReading, parseFuriganaUnits, FuriganaUnit } from './furiganaUtils.js';

const MAX_OVERRIDE_TEXT_LENGTH = 10000;

function matchWordAtIndex(
  units: FuriganaUnit[],
  startIndex: number,
  word: string
): { endIndex: number; surface: string; trailingUnit?: FuriganaUnit } | undefined {
  let surface = '';
  let remaining = word;

  for (let endIndex = startIndex; endIndex < units.length; endIndex++) {
    const unit = units[endIndex];
    const unitSurface = unit.surface;

    if (remaining.startsWith(unitSurface)) {
      surface += unitSurface;
      remaining = remaining.slice(unitSurface.length);

      if (!remaining) {
        return { endIndex, surface };
      }

      continue;
    }

    if (unitSurface.startsWith(remaining) && unit.reading === unitSurface) {
      const trailingSurface = unitSurface.slice(remaining.length);
      surface += remaining;
      return {
        endIndex,
        surface,
        trailingUnit: { surface: trailingSurface, reading: trailingSurface },
      };
    }

    break;
  }

  return undefined;
}

function findKeepMatch(
  units: FuriganaUnit[],
  startIndex: number,
  cache: ReturnType<typeof getDictionaryCache>
) {
  if (!cache) {
    return undefined;
  }
  for (const word of cache.keepKanjiSorted) {
    const match = matchWordAtIndex(units, startIndex, word);
    if (match) {
      return match;
    }
  }

  return undefined;
}

function findForceMatch(
  units: FuriganaUnit[],
  startIndex: number,
  cache: ReturnType<typeof getDictionaryCache>
) {
  if (!cache) {
    return undefined;
  }
  for (const [word, kana] of cache.forceKanaSorted) {
    const match = matchWordAtIndex(units, startIndex, word);
    if (match) {
      return { ...match, kana };
    }
  }

  return undefined;
}

function applyOverridesToUnits(
  units: FuriganaUnit[],
  cache: ReturnType<typeof getDictionaryCache>
): string {
  const output: string[] = [];
  let i = 0;

  while (i < units.length) {
    const keepMatch = findKeepMatch(units, i, cache);
    if (keepMatch) {
      output.push(keepMatch.surface);
      i = keepMatch.endIndex + 1;
      continue;
    }

    const forceMatch = findForceMatch(units, i, cache);
    if (forceMatch) {
      output.push(forceMatch.kana);
      if (forceMatch.trailingUnit) {
        output.push(
          normalizeKanaParticleUnitForTts(
            forceMatch.trailingUnit.surface,
            forceMatch.trailingUnit.reading
          )
        );
      }
      i = forceMatch.endIndex + 1;
      continue;
    }

    pushReadingWithOverlapCollapse(
      output,
      units[i].surface,
      normalizeKanaParticleUnitForTts(units[i].surface, units[i].reading)
    );
    i++;
  }

  return output.join('');
}

function normalizeKanaParticleUnitForTts(surface: string, reading: string): string {
  if (/^は([、。！？!?]|$)/.test(surface)) {
    return reading.replace(/^は/, 'わ');
  }
  if (/^へ([、。！？!?]|$)/.test(surface)) {
    return reading.replace(/^へ/, 'え');
  }
  return reading;
}

function countKanji(text: string): number {
  let count = 0;
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code >= 0x4e00 && code <= 0x9fff) {
      count += 1;
    }
  }
  return count;
}

function pushReadingWithOverlapCollapse(output: string[], surface: string, reading: string) {
  const kanjiCount = countKanji(surface);
  if (kanjiCount === 0) {
    output.push(reading);
    return;
  }

  const maxOverlap = Math.min(reading.length, output.length);
  for (let overlapLen = maxOverlap; overlapLen >= 1; overlapLen--) {
    const suffix = output.slice(output.length - overlapLen).join('');
    if (!reading.startsWith(suffix)) {
      continue;
    }

    const remainingReading = reading.length - overlapLen;
    if (remainingReading < kanjiCount) {
      continue;
    }

    output.splice(output.length - overlapLen, overlapLen);
    break;
  }

  output.push(reading);
}

function applyForceKanaToText(text: string, cache: ReturnType<typeof getDictionaryCache>): string {
  if (!cache) {
    return text;
  }

  let result = text;

  for (const [word, kana] of cache.forceKanaSorted) {
    if (cache.keepKanjiSet.has(word)) {
      continue;
    }
    if (!result.includes(word)) {
      continue;
    }
    result = result.split(word).join(kana);
  }

  return result;
}

function containsAnyWord(text: string, words: string[]): boolean {
  return words.some((word) => word && text.includes(word));
}

export function applyJapanesePronunciationOverrides(params: {
  text: string;
  reading?: string | null;
  furigana?: string | null;
}): string {
  ensureDictionaryLoadedSync();

  const { text, reading, furigana } = params;
  if (text.length > MAX_OVERRIDE_TEXT_LENGTH) {
    logger.warn(
      `[PronunciationDictionary] Text length ${text.length} exceeds ${MAX_OVERRIDE_TEXT_LENGTH}; skipping overrides.`
    );
    return text;
  }

  const readingText = reading?.trim();
  const furiganaText = furigana?.trim();
  const cache = getDictionaryCache();

  const bracketSource =
    (readingText && readingText.includes('[') ? readingText : undefined) ||
    (furiganaText && furiganaText.includes('[') ? furiganaText : undefined);

  if (bracketSource) {
    const units = parseFuriganaUnits(bracketSource);
    const overridden = applyOverridesToUnits(units, cache).trim();
    if (overridden) {
      return overridden;
    }
  }

  const normalizedText = normalizeMatchText(text);
  if (normalizedText && cache) {
    if (cache.keepKanjiSet.has(normalizedText)) {
      return applyForceKanaToText(text, cache);
    }

    const forced = cache.forceKanaMap.get(normalizedText);
    if (forced) {
      return forced;
    }
  }

  const hasKeepMatch =
    normalizedText && cache ? containsAnyWord(normalizedText, cache.keepKanjiSorted) : false;
  if (hasKeepMatch) {
    return applyForceKanaToText(text, cache);
  }

  if (readingText) {
    const normalizedReading = normalizeJapaneseReading(readingText);
    if (normalizedReading.trim()) {
      return normalizedReading;
    }
  }

  return applyForceKanaToText(text, cache);
}
