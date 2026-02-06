// Language service endpoints
const FURIGANA_SERVICE_URL = process.env.FURIGANA_SERVICE_URL || 'http://localhost:8000';

// Track if we've already warned about missing services
let furiganaServiceWarned = false;

export interface JapaneseMetadata {
  kanji: string;
  kana: string;
  furigana: string; // Bracket-style: 漢[かん]字[じ]
}

export interface LanguageMetadata {
  japanese?: JapaneseMetadata;
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

    const data = (await response.json()) as JapaneseMetadata;

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
 * Main language processor — always processes Japanese text
 */
export async function processLanguageText(
  text: string,
  _languageCode: string
): Promise<LanguageMetadata> {
  return { japanese: await processJapanese(text) };
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

    const data = (await response.json()) as JapaneseMetadata[];
    return data;
  } catch (error) {
    if (!furiganaServiceWarned) {
      console.warn('Furigana batch service unavailable, using fallback');
      furiganaServiceWarned = true;
    }
    // Return fallback for all texts
    return texts.map((text) => ({
      kanji: text,
      kana: text,
      furigana: text,
    }));
  }
}

/**
 * Process multiple texts in a single batch request — always processes Japanese
 */
export async function processLanguageTextBatch(
  texts: string[],
  _languageCode: string
): Promise<LanguageMetadata[]> {
  if (texts.length === 0) {
    return [];
  }

  const japaneseResults = await processJapaneseBatch(texts);
  return japaneseResults.map((japanese) => ({ japanese }));
}

/**
 * Convert bracket-style furigana to HTML ruby tags
 * Example: 漢[かん]字[じ] -> <ruby>漢<rt>かん</rt></ruby><ruby>字<rt>じ</rt></ruby>
 */
export function furiganaToRuby(furigana: string): string {
  // Match pattern: kanji[reading]
  const pattern = /([^[\]]+)\[([^\]]+)\]/g;

  return furigana.replace(
    pattern,
    (match, kanji, reading) => `<ruby>${kanji}<rt>${reading}</rt></ruby>`
  );
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
