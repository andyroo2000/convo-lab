import { readFile } from 'fs/promises';
import { join } from 'path';

// Generic vocabulary word interface
interface VocabularyWord {
  word: string;
  translation: string;
  partOfSpeech?: string;
  reading?: string; // For Japanese kana, Chinese pinyin
  example?: string;
}

interface VocabularyData {
  language: string;
  level: string;
  framework: 'JLPT' | 'HSK' | 'CEFR';
  vocabulary: VocabularyWord[];
}

const vocabularyCache = new Map<string, VocabularyWord[]>();

// Map proficiency levels to file names
const LEVEL_FILE_MAP: Record<string, Record<string, string>> = {
  ja: {
    N5: 'n5',
    N4: 'n4',
    N3: 'n3',
    N2: 'n2',
    N1: 'n1',
  },
  zh: {
    HSK1: 'hsk1',
    HSK2: 'hsk2',
    HSK3: 'hsk3',
    HSK4: 'hsk4',
    HSK5: 'hsk5',
    HSK6: 'hsk6',
  },
  es: {
    A1: 'a1',
    A2: 'a2',
    B1: 'b1',
    B2: 'b2',
    C1: 'c1',
    C2: 'c2',
  },
  fr: {
    A1: 'a1',
    A2: 'a2',
    B1: 'b1',
    B2: 'b2',
    C1: 'c1',
    C2: 'c2',
  },
  ar: {
    A1: 'a1',
    A2: 'a2',
    B1: 'b1',
    B2: 'b2',
    C1: 'c1',
    C2: 'c2',
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
    const data: VocabularyData = JSON.parse(await readFile(filePath, 'utf-8'));
    vocabularyCache.set(cacheKey, data.vocabulary);
    return data.vocabulary;
  } catch (error) {
    console.error(`Failed to load vocabulary for ${language}:${level}:`, error);
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

export function formatWordsForPrompt(words: VocabularyWord[], language: string): string {
  if (words.length === 0) return '';

  // Format based on language
  if (language === 'ja') {
    return words.map((w) => `${w.word} (${w.reading || ''}) - ${w.translation}`).join(', ');
  } else if (language === 'zh') {
    return words.map((w) => `${w.word} (${w.reading || ''}) - ${w.translation}`).join(', ');
  } else {
    // Spanish, French, Arabic - just word and translation
    return words.map((w) => `${w.word} - ${w.translation}`).join(', ');
  }
}

// Get proficiency framework name for display
export function getProficiencyFramework(language: string): string {
  const frameworks: Record<string, string> = {
    ja: 'JLPT',
    zh: 'HSK',
    es: 'CEFR',
    fr: 'CEFR',
    ar: 'CEFR',
  };
  return frameworks[language] || 'proficiency level';
}
