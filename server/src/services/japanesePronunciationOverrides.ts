import * as fs from 'fs';
import path from 'path';

import { logger } from './logger.js';

export interface JapanesePronunciationDictionary {
  keepKanji: string[];
  forceKana: Record<string, string>;
  updatedAt?: string;
}

interface DictionaryCache {
  keepKanjiWords: string[];
  keepKanjiSet: Set<string>;
  keepKanjiSorted: string[];
  forceKanaEntries: Array<[string, string]>;
  forceKanaMap: Map<string, string>;
  forceKanaSorted: Array<[string, string]>;
}

interface FuriganaUnit {
  surface: string;
  reading: string;
}

const DEFAULT_DICTIONARY: JapanesePronunciationDictionary = {
  keepKanji: ['橋', '箸', '端', '今', '居間', '牡蠣', '垣', '柿', '酒', '鮭', '二本', '日本'],
  forceKana: {
    北海道: 'ほっかいどう',
    札幌: 'さっぽろ',
    函館: 'はこだて',
    小樽: 'おたる',
    釧路: 'くしろ',
    稚内: 'わっかない',
    帯広: 'おびひろ',
    旭川: 'あさひかわ',
    大通公園: 'おおどおりこうえん',
    新宿: 'しんじゅく',
    渋谷: 'しぶや',
    浅草: 'あさくさ',
    上野: 'うえの',
    梅田: 'うめだ',
    難波: 'なんば',
    心斎橋: 'しんさいばし',
    祇園: 'ぎおん',
    嵐山: 'あらしやま',
    清水寺: 'きよみずでら',
    季節: 'きせつ',
  },
};

function resolveDictionaryPath(): string {
  const cwd = process.cwd();
  const isServerPackage =
    fs.existsSync(path.join(cwd, 'src')) && fs.existsSync(path.join(cwd, 'package.json'));
  const root = isServerPackage
    ? cwd
    : fs.existsSync(path.join(cwd, 'server'))
      ? path.join(cwd, 'server')
      : cwd;
  const candidates = [
    path.join(root, 'data', 'pronunciation', 'ja.json'),
    path.join(root, 'src', 'data', 'pronunciation', 'ja.json'),
    path.join(root, 'dist', 'data', 'pronunciation', 'ja.json'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

const DICTIONARY_PATH = resolveDictionaryPath();

function normalizeMatchText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, '')
    .replace(/^[「『（(【［["'“”]+/, '')
    .replace(/[」』）)】］\]"'“”]+$/, '');
}

function normalizeDictionary(
  input: JapanesePronunciationDictionary
): JapanesePronunciationDictionary {
  const keepKanji = Array.isArray(input.keepKanji) ? input.keepKanji : [];
  const normalizedKeep = keepKanji
    .map((entry) => (typeof entry === 'string' ? normalizeMatchText(entry) : ''))
    .filter(Boolean);
  const keepSet = new Set(normalizedKeep);
  const keepKanjiSorted = [...keepSet].sort((a, b) => a.localeCompare(b));

  const rawForceKana =
    input.forceKana && typeof input.forceKana === 'object' ? input.forceKana : {};
  const forceEntries = Object.entries(rawForceKana)
    .map(
      ([word, kana]) =>
        [
          typeof word === 'string' ? normalizeMatchText(word) : '',
          typeof kana === 'string' ? kana.trim() : '',
        ] as const
    )
    .filter(([word, kana]) => word && kana)
    .sort((a, b) => a[0].localeCompare(b[0]));

  const forceKana: Record<string, string> = {};
  for (const [word, kana] of forceEntries) {
    forceKana[word] = kana;
  }

  return {
    keepKanji: keepKanjiSorted,
    forceKana,
  };
}

function loadDictionaryFromDisk(): JapanesePronunciationDictionary {
  try {
    if (!fs.existsSync(DICTIONARY_PATH)) {
      persistDictionary(DEFAULT_DICTIONARY);
      return normalizeDictionary(DEFAULT_DICTIONARY);
    }

    const raw = fs.readFileSync(DICTIONARY_PATH, 'utf8');
    const parsed = JSON.parse(raw) as JapanesePronunciationDictionary;
    const normalized = normalizeDictionary(parsed);
    return {
      ...normalized,
      updatedAt: parsed.updatedAt,
    };
  } catch (error) {
    logger.warn('[PronunciationDictionary] Failed to load dictionary, using defaults.', error);
    return normalizeDictionary(DEFAULT_DICTIONARY);
  }
}

function persistDictionary(dictionary: JapanesePronunciationDictionary) {
  const dir = path.dirname(DICTIONARY_PATH);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DICTIONARY_PATH, `${JSON.stringify(dictionary, null, 2)}\n`, 'utf8');
}

function buildCache(dictionary: JapanesePronunciationDictionary): DictionaryCache {
  const keepKanjiWords = dictionary.keepKanji.map(normalizeMatchText).filter(Boolean);
  const keepKanjiSet = new Set(keepKanjiWords);
  const keepKanjiSorted = [...keepKanjiSet].sort((a, b) => b.length - a.length);

  const forceKanaEntries = Object.entries(dictionary.forceKana)
    .map(([word, kana]) => [normalizeMatchText(word), kana] as const)
    .filter(([word, kana]) => word && kana);
  const forceKanaMap = new Map(forceKanaEntries);
  const forceKanaSorted = [...forceKanaEntries].sort((a, b) => b[0].length - a[0].length);

  return {
    keepKanjiWords,
    keepKanjiSet,
    keepKanjiSorted,
    forceKanaEntries,
    forceKanaMap,
    forceKanaSorted,
  };
}

let dictionaryState: JapanesePronunciationDictionary | null = null;
let dictionaryCache: DictionaryCache | null = null;

function ensureDictionaryLoaded() {
  if (dictionaryState && dictionaryCache) {
    return;
  }

  const loaded = loadDictionaryFromDisk();
  dictionaryState = loaded;
  dictionaryCache = buildCache(loaded);
}

export function getJapanesePronunciationDictionary(): JapanesePronunciationDictionary {
  ensureDictionaryLoaded();
  if (!dictionaryState) {
    return { keepKanji: [], forceKana: {} };
  }

  return {
    keepKanji: [...dictionaryState.keepKanji],
    forceKana: { ...dictionaryState.forceKana },
    updatedAt: dictionaryState.updatedAt,
  };
}

export async function updateJapanesePronunciationDictionary(
  dictionary: JapanesePronunciationDictionary
): Promise<JapanesePronunciationDictionary> {
  ensureDictionaryLoaded();

  const normalized = normalizeDictionary(dictionary);
  const updated: JapanesePronunciationDictionary = {
    ...normalized,
    updatedAt: new Date().toISOString(),
  };

  await fs.promises.mkdir(path.dirname(DICTIONARY_PATH), { recursive: true });
  await fs.promises.writeFile(DICTIONARY_PATH, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');

  dictionaryState = updated;
  dictionaryCache = buildCache(updated);

  return getJapanesePronunciationDictionary();
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
  let output = '';
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
      output += char;
      continue;
    }

    if (isKana(char) || isPunctuation(char) || /\s/.test(char)) {
      output += char;
    }
  }

  return output;
}

function normalizeJapaneseReading(reading: string): string {
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

function parseFuriganaUnits(furigana: string): FuriganaUnit[] {
  const units: FuriganaUnit[] = [];
  let buffer = '';
  let i = 0;

  while (i < furigana.length) {
    const char = furigana[i];
    if (char === '[') {
      let reading = '';
      i++;
      while (i < furigana.length && furigana[i] !== ']') {
        reading += furigana[i];
        i++;
      }
      i++;

      if (buffer) {
        units.push(...splitSurfaceForReading(buffer, reading));
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

function matchWordAtIndex(
  units: FuriganaUnit[],
  startIndex: number,
  word: string
): { endIndex: number; surface: string } | undefined {
  let surface = '';

  for (let endIndex = startIndex; endIndex < units.length; endIndex++) {
    surface += units[endIndex].surface;

    if (surface === word) {
      return { endIndex, surface };
    }

    if (surface.length >= word.length) {
      break;
    }
  }

  return undefined;
}

function findKeepMatch(units: FuriganaUnit[], startIndex: number) {
  if (!dictionaryCache) {
    return undefined;
  }

  for (const word of dictionaryCache.keepKanjiSorted) {
    const match = matchWordAtIndex(units, startIndex, word);
    if (match) {
      return match;
    }
  }

  return undefined;
}

function findForceMatch(units: FuriganaUnit[], startIndex: number) {
  if (!dictionaryCache) {
    return undefined;
  }

  for (const [word, kana] of dictionaryCache.forceKanaSorted) {
    const match = matchWordAtIndex(units, startIndex, word);
    if (match) {
      return { ...match, kana };
    }
  }

  return undefined;
}

function applyOverridesToUnits(units: FuriganaUnit[]): string {
  let output = '';
  let i = 0;

  while (i < units.length) {
    const keepMatch = findKeepMatch(units, i);
    if (keepMatch) {
      output += keepMatch.surface;
      i = keepMatch.endIndex + 1;
      continue;
    }

    const forceMatch = findForceMatch(units, i);
    if (forceMatch) {
      output += forceMatch.kana;
      i = forceMatch.endIndex + 1;
      continue;
    }

    output += units[i].reading;
    i++;
  }

  return output;
}

function applyForceKanaToText(text: string): string {
  if (!dictionaryCache) {
    return text;
  }

  let result = text;

  for (const [word, kana] of dictionaryCache.forceKanaSorted) {
    if (!dictionaryCache.keepKanjiSet.has(word)) {
      result = result.split(word).join(kana);
    }
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
  ensureDictionaryLoaded();

  const { text, reading, furigana } = params;
  const readingText = reading?.trim();
  const furiganaText = furigana?.trim();

  const bracketSource =
    (readingText && readingText.includes('[') ? readingText : undefined) ||
    (furiganaText && furiganaText.includes('[') ? furiganaText : undefined);

  if (bracketSource) {
    const units = parseFuriganaUnits(bracketSource);
    const overridden = applyOverridesToUnits(units).trim();
    if (overridden) {
      return overridden;
    }
  }

  const normalizedText = normalizeMatchText(text);
  if (normalizedText && dictionaryCache) {
    if (dictionaryCache.keepKanjiSet.has(normalizedText)) {
      return applyForceKanaToText(text);
    }

    const forced = dictionaryCache.forceKanaMap.get(normalizedText);
    if (forced) {
      return forced;
    }
  }

  const hasKeepMatch =
    normalizedText && dictionaryCache
      ? containsAnyWord(normalizedText, dictionaryCache.keepKanjiSorted)
      : false;
  if (hasKeepMatch) {
    return applyForceKanaToText(text);
  }

  if (readingText) {
    const normalizedReading = normalizeJapaneseReading(readingText);
    if (normalizedReading.trim()) {
      return normalizedReading;
    }
  }

  return applyForceKanaToText(text);
}
