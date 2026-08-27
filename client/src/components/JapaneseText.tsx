import type { CSSProperties, ReactNode } from 'react';
import { LanguageMetadata } from '../types';

interface JapaneseTextProps {
  text: string;
  metadata?: LanguageMetadata;
  className?: string;
  style?: CSSProperties;
  showFurigana?: boolean;
}

/**
 * Check if a character is hiragana
 */
function isHiragana(char: string): boolean {
  if (!char) return false;
  const code = char.charCodeAt(0);
  return code >= 0x3040 && code <= 0x309f;
}

/**
 * Check if a character is katakana
 */
function isKatakana(char: string): boolean {
  if (!char) return false;
  const code = char.charCodeAt(0);
  return code >= 0x30a0 && code <= 0x30ff;
}

/**
 * Check if a character is kana (hiragana or katakana)
 */
function isKana(char: string): boolean {
  return isHiragana(char) || isKatakana(char);
}

/**
 * Converts bracket notation to React ruby elements.
 * Input: "買[か]い物[もの]" or "が東京[とうきょう]" (with incorrect particles)
 *
 * Returning React nodes instead of an HTML string is important here: course
 * content can come from users or generated content, so React must retain
 * responsibility for escaping every text segment.
 */
function renderRuby(text: string): ReactNode[] {
  // Pattern matches any characters (kanji, hiragana, katakana) followed by bracket notation
  const rubyPattern = /([\u4E00-\u9FAF\u3040-\u309F\u30A0-\u30FF]+)\[([^\]]+)\]/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match = rubyPattern.exec(text);

  while (match !== null) {
    const [matchedText, base, reading] = match;

    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    // Remove extra spaces from the reading
    const cleanReading = reading.replace(/\s+/g, '');

    // Find where the kanji starts (skip leading kana - hiragana/katakana particles)
    let kanjiStart = 0;
    while (kanjiStart < base.length && isKana(base[kanjiStart])) {
      kanjiStart += 1;
    }

    // Find where the kanji ends (skip trailing kana - okurigana)
    let kanjiEnd = base.length;
    while (kanjiEnd > kanjiStart && isKana(base[kanjiEnd - 1])) {
      kanjiEnd -= 1;
    }

    // If no kanji found, use the whole base (might be katakana or special case)
    if (kanjiStart >= base.length || kanjiStart >= kanjiEnd) {
      nodes.push(
        <ruby key={match.index}>
          {base}
          <rt>{cleanReading}</rt>
        </ruby>
      );
    } else {
      // Extract prefix, kanji, and suffix
      const prefix = base.substring(0, kanjiStart);
      const kanjiPart = base.substring(kanjiStart, kanjiEnd);
      const suffix = base.substring(kanjiEnd);

      // Adjust reading to only cover the kanji portion
      let adjustedReading = cleanReading;
      if (suffix && cleanReading.endsWith(suffix)) {
        adjustedReading = cleanReading.substring(0, cleanReading.length - suffix.length);
      }

      nodes.push(
        prefix,
        <ruby key={match.index}>
          {kanjiPart}
          <rt>{adjustedReading}</rt>
        </ruby>,
        suffix
      );
    }

    lastIndex = match.index + matchedText.length;
    match = rubyPattern.exec(text);
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

/**
 * Removes bracket notation, leaving only the base text
 * Input: "買[か]い物[もの]" or "お正月休み[おしょうがつやすみ]"
 * Output: "買い物" or "お正月休み"
 */
function stripFurigana(text: string): string {
  const rubyPattern = /([\u4E00-\u9FAF\u3040-\u309F]+)\[([^\]]+)\]/g;
  return text.replace(rubyPattern, '$1');
}

const JapaneseText = ({
  text,
  metadata,
  className = '',
  style,
  showFurigana = true,
}: JapaneseTextProps) => {
  // If showFurigana is false, use plain kanji text without readings
  // Otherwise use furigana from metadata if available
  const displayText = showFurigana
    ? metadata?.japanese?.furigana || text
    : metadata?.japanese?.kanji || stripFurigana(text);

  return (
    <span className={`japanese-text ${className}`} style={style}>
      {showFurigana ? renderRuby(displayText) : displayText}
    </span>
  );
};

export default JapaneseText;
