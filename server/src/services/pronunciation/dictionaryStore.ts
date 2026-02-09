import * as fs from 'fs';
import path from 'path';

import { logger } from '../logger.js';

import { normalizeMatchText } from './textUtils.js';

export interface JapanesePronunciationDictionary {
  keepKanji: string[];
  forceKana: Record<string, string>;
  updatedAt?: string;
}

export interface DictionaryCache {
  keepKanjiWords: string[];
  keepKanjiSet: Set<string>;
  keepKanjiSorted: string[];
  forceKanaEntries: Array<[string, string]>;
  forceKanaMap: Map<string, string>;
  forceKanaSorted: Array<[string, string]>;
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

const DICTIONARY_PATH_ENV = 'PRONUNCIATION_DICTIONARY_PATH';

function isServerPackageRoot(dir: string): boolean {
  const hasPackageJson = fs.existsSync(path.join(dir, 'package.json'));
  const hasRoutes =
    fs.existsSync(path.join(dir, 'src', 'routes')) ||
    fs.existsSync(path.join(dir, 'dist', 'routes'));
  return hasPackageJson && hasRoutes;
}

function findUp(startDir: string, predicate: (dir: string) => boolean): string | null {
  let current = startDir;
  for (;;) {
    if (predicate(current)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function resolveServerRoot(cwd: string): string {
  const root = findUp(cwd, isServerPackageRoot);
  if (root) {
    return path.resolve(root);
  }

  const repoRoot = findUp(cwd, (dir) => fs.existsSync(path.join(dir, 'server')));
  if (repoRoot) {
    const serverRoot = path.join(repoRoot, 'server');
    if (isServerPackageRoot(serverRoot)) {
      return path.resolve(serverRoot);
    }
  }

  throw new Error(`[PronunciationDictionary] Unable to resolve server root from cwd: ${cwd}`);
}

function assertPathWithinRoot(root: string, candidate: string, label: string) {
  const relative = path.relative(root, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(
      `[PronunciationDictionary] ${label} path must stay within server root: ${candidate}`
    );
  }
}

/**
 * Resolve the pronunciation dictionary file path.
 *
 * Search order:
 * 1) `PRONUNCIATION_DICTIONARY_PATH` (relative to server root or absolute)
 * 2) `<server>/data/pronunciation/ja.json`
 * 3) `<server>/src/data/pronunciation/ja.json`
 * 4) `<server>/dist/data/pronunciation/ja.json`
 */
function resolveDictionaryPath(root: string): string {
  const envPath = process.env[DICTIONARY_PATH_ENV];
  if (envPath) {
    const resolved = path.isAbsolute(envPath) ? path.resolve(envPath) : path.resolve(root, envPath);
    assertPathWithinRoot(root, resolved, `Override (${DICTIONARY_PATH_ENV})`);
    return resolved;
  }

  const candidates = [
    path.join(root, 'data', 'pronunciation', 'ja.json'),
    path.join(root, 'src', 'data', 'pronunciation', 'ja.json'),
    path.join(root, 'dist', 'data', 'pronunciation', 'ja.json'),
  ].map((candidate) => path.resolve(candidate));

  for (const candidate of candidates) {
    assertPathWithinRoot(root, candidate, 'Dictionary');
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

const DICTIONARY_ROOT = resolveServerRoot(process.cwd());
const DICTIONARY_PATH = resolveDictionaryPath(DICTIONARY_ROOT);

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
    .map(([word, kana]) => [normalizeMatchText(word), kana] as [string, string])
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
let loadingPromise: Promise<void> | null = null;

function loadDictionaryIntoCache() {
  const loaded = loadDictionaryFromDisk();
  dictionaryState = loaded;
  dictionaryCache = buildCache(loaded);
}

export function ensureDictionaryLoadedSync() {
  if (dictionaryState && dictionaryCache) {
    return;
  }
  loadDictionaryIntoCache();
}

export async function ensureDictionaryLoadedAsync() {
  if (dictionaryState && dictionaryCache) {
    return;
  }
  if (!loadingPromise) {
    loadingPromise = new Promise((resolve, reject) => {
      try {
        loadDictionaryIntoCache();
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  try {
    await loadingPromise;
  } finally {
    loadingPromise = null;
  }
}

export function getDictionaryCache(): DictionaryCache | null {
  ensureDictionaryLoadedSync();
  return dictionaryCache;
}

export function getJapanesePronunciationDictionary(): JapanesePronunciationDictionary {
  ensureDictionaryLoadedSync();
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
  await ensureDictionaryLoadedAsync();

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

export { normalizeMatchText };
