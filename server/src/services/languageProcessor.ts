export interface JapaneseMetadata {
  kanji: string;
  kana: string;
  furigana: string; // Bracket-style: 漢[かん]字[じ]
}

export interface LanguageMetadata {
  japanese?: JapaneseMetadata;
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
    (_match, kanji, reading) => `<ruby>${kanji}<rt>${reading}</rt></ruby>`
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
