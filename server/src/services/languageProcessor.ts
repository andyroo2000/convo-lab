// Furigana service endpoint
const FURIGANA_SERVICE_URL = process.env.FURIGANA_SERVICE_URL || 'http://localhost:8000';

export interface JapaneseMetadata {
  kanji: string;
  kana: string;
  furigana: string; // Bracket-style: 漢[かん]字[じ]
}

export interface ChineseMetadata {
  characters: string;
  pinyin: string;
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
    console.error('Japanese processing error:', error);
    // Return fallback
    return {
      kanji: text,
      kana: text,
      furigana: text,
    };
  }
}

/**
 * Process Chinese text to extract characters and pinyin
 * Note: This is a placeholder. For production, use a library like pinyin-pro
 */
export async function processChinese(text: string): Promise<ChineseMetadata> {
  // TODO: Implement proper pinyin conversion
  // For now, return placeholder
  return {
    characters: text,
    pinyin: '', // Would use a pinyin library here
  };
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
