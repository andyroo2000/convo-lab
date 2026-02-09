import { LanguageMetadata } from '../types';

interface JapaneseTextProps {
  text: string;
  metadata?: LanguageMetadata;
  className?: string;
  showFurigana?: boolean;
}

/**
 * Check if a character is kanji
 */
function _isKanji(char: string): boolean {
  if (!char) return false;
  const code = char.charCodeAt(0);
  return code >= 0x4e00 && code <= 0x9faf;
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
 * Converts bracket notation to HTML ruby tags
 * Input: "買[か]い物[もの]" or "が東京[とうきょう]" (with incorrect particles)
 * Output: "<ruby>買<rt>か</rt></ruby>い<ruby>物<rt>もの</rt></ruby>" or "が<ruby>東京<rt>とうきょう</rt></ruby>"
 */
function renderRuby(text: string): string {
  // Pattern matches any characters (kanji, hiragana, katakana) followed by bracket notation
  const rubyPattern = /([\u4E00-\u9FAF\u3040-\u309F\u30A0-\u30FF]+)\[([^\]]+)\]/g;

  return text.replace(rubyPattern, (match, base, reading) => {
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
      return `<ruby>${base}<rt>${cleanReading}</rt></ruby>`;
    }

    // Extract prefix, kanji, and suffix
    const prefix = base.substring(0, kanjiStart);
    const kanjiPart = base.substring(kanjiStart, kanjiEnd);
    const suffix = base.substring(kanjiEnd);

    // Adjust reading to only cover the kanji portion
    let adjustedReading = cleanReading;
    if (suffix && cleanReading.endsWith(suffix)) {
      adjustedReading = cleanReading.substring(0, cleanReading.length - suffix.length);
    }

    // Return: prefix + <ruby>kanji<rt>reading</rt></ruby> + suffix
    return `${prefix}<ruby>${kanjiPart}<rt>${adjustedReading}</rt></ruby>${suffix}`;
  });
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
  showFurigana = true,
}: JapaneseTextProps) => {
  // If showFurigana is false, use plain kanji text without readings
  // Otherwise use furigana from metadata if available
  const displayText = showFurigana
    ? metadata?.japanese?.furigana || text
    : metadata?.japanese?.kanji || stripFurigana(text);

  const htmlString = showFurigana ? renderRuby(displayText) : displayText;

  return (
    <span
      className={`japanese-text ${className}`}
      // Intentional: Rendering furigana ruby HTML from trusted source (metadata or bracket notation)
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: htmlString }}
    />
  );
};

export default JapaneseText;
