import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Generic vocabulary word interface
interface VocabularyWord {
  word: string;
  translation: string;
  partOfSpeech?: string;
  reading?: string; // For Japanese kana
  example?: string;
}

interface VocabularyData {
  language: string;
  level: string;
  framework: 'JLPT';
  vocabulary: VocabularyWord[];
}

// Grammar point interface
interface GrammarPoint {
  pattern: string;
  meaning: string;
  usage: string;
  example: string;
  exampleTranslation: string;
}

interface GrammarData {
  language: string;
  level: string;
  framework: 'JLPT';
  grammarPoints: GrammarPoint[];
}

const vocabularyCache = new Map<string, VocabularyWord[]>();
const grammarCache = new Map<string, GrammarPoint[]>();

// Map proficiency levels to file names
const LEVEL_FILE_MAP: Record<string, Record<string, string>> = {
  ja: {
    N5: 'n5',
    N4: 'n4',
    N3: 'n3',
    N2: 'n2',
    N1: 'n1',
  },
};

export async function getVocabularyForLevel(
  language: string,
  level: string
): Promise<VocabularyWord[]> {
  const cacheKey = `${language}:${level}`;
  if (vocabularyCache.has(cacheKey)) {
    return vocabularyCache.get(cacheKey)!;
  }

  const fileName = LEVEL_FILE_MAP[language]?.[level];
  if (!fileName) {
    console.warn(`No vocabulary file mapping for ${language}:${level}`);
    return [];
  }

  try {
    const filePath = join(__dirname, '../data/vocabulary', language, `${fileName}.json`);
    // eslint-disable-next-line no-console
    console.log(`[VocabSeeding] Attempting to load vocabulary from: ${filePath}`);
    const data: VocabularyData = JSON.parse(await readFile(filePath, 'utf-8'));
    // eslint-disable-next-line no-console
    console.log(
      `[VocabSeeding] Successfully loaded ${data.vocabulary.length} words for ${language}:${level}`
    );
    vocabularyCache.set(cacheKey, data.vocabulary);
    return data.vocabulary;
  } catch (error) {
    console.error(
      `[VocabSeeding] Failed to load vocabulary for ${language}:${level} from ${join(__dirname, '../data/vocabulary', language, `${fileName}.json`)}:`,
      error
    );
    return [];
  }
}

export async function sampleVocabulary(
  language: string,
  level: string,
  count: number = 30
): Promise<VocabularyWord[]> {
  const allWords = await getVocabularyForLevel(language, level);
  if (allWords.length === 0) return [];

  // Random sampling
  const shuffled = [...allWords].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, allWords.length));
}

export function formatWordsForPrompt(words: VocabularyWord[], _language: string): string {
  if (words.length === 0) return '';

  return words.map((w) => `${w.word} (${w.reading || ''}) - ${w.translation}`).join(', ');
}

// Get proficiency framework name for display
export function getProficiencyFramework(_language: string): string {
  return 'JLPT';
}

// ===== Grammar Seeding Functions =====

export async function getGrammarForLevel(language: string, level: string): Promise<GrammarPoint[]> {
  const cacheKey = `${language}:${level}`;
  if (grammarCache.has(cacheKey)) {
    return grammarCache.get(cacheKey)!;
  }

  const fileName = LEVEL_FILE_MAP[language]?.[level];
  if (!fileName) {
    console.warn(`No grammar file mapping for ${language}:${level}`);
    return [];
  }

  try {
    const filePath = join(__dirname, '../data/grammar', language, `${fileName}.json`);
    // eslint-disable-next-line no-console
    console.log(`[GrammarSeeding] Attempting to load grammar from: ${filePath}`);
    const data: GrammarData = JSON.parse(await readFile(filePath, 'utf-8'));
    // eslint-disable-next-line no-console
    console.log(
      `[GrammarSeeding] Successfully loaded ${data.grammarPoints.length} grammar points for ${language}:${level}`
    );
    grammarCache.set(cacheKey, data.grammarPoints);
    return data.grammarPoints;
  } catch (error) {
    console.error(
      `[GrammarSeeding] Failed to load grammar for ${language}:${level} from ${join(__dirname, '../data/grammar', language, `${fileName}.json`)}:`,
      error
    );
    return [];
  }
}

export async function sampleGrammar(
  language: string,
  level: string,
  count: number = 5
): Promise<GrammarPoint[]> {
  const allGrammar = await getGrammarForLevel(language, level);
  if (allGrammar.length === 0) return [];

  // Random sampling
  const shuffled = [...allGrammar].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, allGrammar.length));
}

export function formatGrammarForPrompt(grammarPoints: GrammarPoint[]): string {
  if (grammarPoints.length === 0) return '';

  return grammarPoints
    .map((g) => `- ${g.pattern} (${g.meaning}): ${g.example} (${g.exampleTranslation})`)
    .join('\n');
}
