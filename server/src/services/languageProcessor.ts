// Language service endpoints
const FURIGANA_SERVICE_URL = process.env.FURIGANA_SERVICE_URL || 'http://localhost:8000';
const PINYIN_SERVICE_URL = process.env.PINYIN_SERVICE_URL || 'http://localhost:8001';

// Track if we've already warned about missing services
let furiganaServiceWarned = false;
let pinyinServiceWarned = false;

export interface JapaneseMetadata {
  kanji: string;
  kana: string;
  furigana: string; // Bracket-style: 漢[かん]字[じ]
}

export interface ChineseMetadata {
  characters: string;
  pinyinToneMarks: string;  // nǐ hǎo
  pinyinToneNumbers: string; // ni3 hao3
}

export interface LanguageMetadata {
  japanese?: JapaneseMetadata;
  chinese?: ChineseMetadata;
}

/**
 * Process Japanese text to extract kanji, kana, and bracket-style furigana
 * Uses Python microservice for furigana generation
 */
export async function processJapanese(text: string): Promise<JapaneseMetadata> {
  try {
    const response = await fetch(`${FURIGANA_SERVICE_URL}/furigana`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error(`Furigana service error: ${response.statusText}`);
    }

    const data = await response.json() as JapaneseMetadata;

    return {
      kanji: data.kanji,
      kana: data.kana,
      furigana: data.furigana,
    };
  } catch (error) {
    // Only log warning once to avoid spam
    if (!furiganaServiceWarned) {
      console.warn('Furigana service unavailable, using fallback (text without furigana)');
      furiganaServiceWarned = true;
    }
    // Return fallback - content will work but without furigana annotations
    return {
      kanji: text,
      kana: text,
      furigana: text,
    };
  }
}

/**
 * Process Chinese text to extract characters and pinyin (both tone mark and tone number formats)
 * Uses Python microservice for pinyin generation
 */
export async function processChinese(text: string): Promise<ChineseMetadata> {
  try {
    const response = await fetch(`${PINYIN_SERVICE_URL}/pinyin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error(`Pinyin service error: ${response.statusText}`);
    }

    const data = await response.json() as ChineseMetadata;

    return {
      characters: data.characters,
      pinyinToneMarks: data.pinyinToneMarks,
      pinyinToneNumbers: data.pinyinToneNumbers,
    };
  } catch (error) {
    // Only log warning once to avoid spam
    if (!pinyinServiceWarned) {
      console.warn('Pinyin service unavailable, using fallback (text without pinyin)');
      pinyinServiceWarned = true;
    }
    // Return fallback - content will work but without pinyin annotations
    return {
      characters: text,
      pinyinToneMarks: '',
      pinyinToneNumbers: '',
    };
  }
}

/**
 * Main language processor that routes to appropriate language handler
 */
export async function processLanguageText(
  text: string,
  languageCode: string
): Promise<LanguageMetadata> {
  const metadata: LanguageMetadata = {};

  switch (languageCode) {
    case 'ja':
      metadata.japanese = await processJapanese(text);
      break;
    case 'zh':
      metadata.chinese = await processChinese(text);
      break;
    // Add more languages here as needed
    default:
      // For languages without special processing, return empty metadata
      break;
  }

  return metadata;
}

/**
 * Process multiple Japanese texts in a single batch request
 * Uses the /furigana/batch endpoint for efficiency
 */
export async function processJapaneseBatch(texts: string[]): Promise<JapaneseMetadata[]> {
  if (texts.length === 0) {
    return [];
  }

  try {
    const response = await fetch(`${FURIGANA_SERVICE_URL}/furigana/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ texts }),
    });

    if (!response.ok) {
      throw new Error(`Furigana batch service error: ${response.statusText}`);
    }

    const data = await response.json() as JapaneseMetadata[];
    return data;
  } catch (error) {
    if (!furiganaServiceWarned) {
      console.warn('Furigana batch service unavailable, using fallback');
      furiganaServiceWarned = true;
    }
    // Return fallback for all texts
    return texts.map(text => ({
      kanji: text,
      kana: text,
      furigana: text,
    }));
  }
}

/**
 * Process multiple Chinese texts in a single batch request
 * Uses the /pinyin/batch endpoint for efficiency
 */
export async function processChineseBatch(texts: string[]): Promise<ChineseMetadata[]> {
  if (texts.length === 0) {
    return [];
  }

  try {
    const response = await fetch(`${PINYIN_SERVICE_URL}/pinyin/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ texts }),
    });

    if (!response.ok) {
      throw new Error(`Pinyin batch service error: ${response.statusText}`);
    }

    const data = await response.json() as ChineseMetadata[];
    return data;
  } catch (error) {
    if (!pinyinServiceWarned) {
      console.warn('Pinyin batch service unavailable, using fallback');
      pinyinServiceWarned = true;
    }
    // Return fallback for all texts
    return texts.map(text => ({
      characters: text,
      pinyinToneMarks: '',
      pinyinToneNumbers: '',
    }));
  }
}

/**
 * Process multiple texts in a single batch request
 * Routes to appropriate language handler based on language code
 */
export async function processLanguageTextBatch(
  texts: string[],
  languageCode: string
): Promise<LanguageMetadata[]> {
  if (texts.length === 0) {
    return [];
  }

  switch (languageCode) {
    case 'ja': {
      const japaneseResults = await processJapaneseBatch(texts);
      return japaneseResults.map(japanese => ({ japanese }));
    }
    case 'zh': {
      const chineseResults = await processChineseBatch(texts);
      return chineseResults.map(chinese => ({ chinese }));
    }
    default:
      // For languages without special processing, return empty metadata
      return texts.map(() => ({}));
  }
}

/**
 * Convert bracket-style furigana to HTML ruby tags
 * Example: 漢[かん]字[じ] -> <ruby>漢<rt>かん</rt></ruby><ruby>字<rt>じ</rt></ruby>
 */
export function furiganaToRuby(furigana: string): string {
  // Match pattern: kanji[reading]
  const pattern = /([^[\]]+)\[([^\]]+)\]/g;

  return furigana.replace(pattern, (match, kanji, reading) => {
    return `<ruby>${kanji}<rt>${reading}</rt></ruby>`;
  });
}

/**
 * Extract plain text from furigana notation
 * Example: 漢[かん]字[じ] -> 漢字
 */
export function extractKanjiFromFurigana(furigana: string): string {
  return furigana.replace(/\[([^\]]+)\]/g, '');
}

/**
 * Extract plain reading from furigana notation
 * Example: 漢[かん]字[じ] -> かんじ
 */
export function extractReadingFromFurigana(furigana: string): string {
  const pattern = /([^[\]]+)\[([^\]]+)\]/g;
  let result = '';
  let match;
  let lastIndex = 0;

  while ((match = pattern.exec(furigana)) !== null) {
    // Add any text before this match (hiragana/katakana that doesn't need furigana)
    if (match.index > lastIndex) {
      result += furigana.substring(lastIndex, match.index);
    }

    // Add the reading
    result += match[2];
    lastIndex = pattern.lastIndex;
  }

  // Add any remaining text
  if (lastIndex < furigana.length) {
    result += furigana.substring(lastIndex);
  }

  return result;
}
