import { LanguageMetadata } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface ChineseTextProps {
  text: string;
  metadata?: LanguageMetadata;
  className?: string;
  showPinyin?: boolean;
}

// Tone mark to number mappings
const TONE_MARK_MAP: Record<string, { base: string; tone: number }> = {
  ā: { base: 'a', tone: 1 },
  á: { base: 'a', tone: 2 },
  ǎ: { base: 'a', tone: 3 },
  à: { base: 'a', tone: 4 },
  ē: { base: 'e', tone: 1 },
  é: { base: 'e', tone: 2 },
  ě: { base: 'e', tone: 3 },
  è: { base: 'e', tone: 4 },
  ī: { base: 'i', tone: 1 },
  í: { base: 'i', tone: 2 },
  ǐ: { base: 'i', tone: 3 },
  ì: { base: 'i', tone: 4 },
  ō: { base: 'o', tone: 1 },
  ó: { base: 'o', tone: 2 },
  ǒ: { base: 'o', tone: 3 },
  ò: { base: 'o', tone: 4 },
  ū: { base: 'u', tone: 1 },
  ú: { base: 'u', tone: 2 },
  ǔ: { base: 'u', tone: 3 },
  ù: { base: 'u', tone: 4 },
  ǖ: { base: 'ü', tone: 1 },
  ǘ: { base: 'ü', tone: 2 },
  ǚ: { base: 'ü', tone: 3 },
  ǜ: { base: 'ü', tone: 4 },
};

/**
 * Convert pinyin with tone marks to pinyin with tone numbers
 * Example: zhāng → zhang1, nǐ hǎo → ni3 hao3
 */
function convertToneMarksToNumbers(pinyin: string): string {
  let result = '';
  let tone = 0;

  for (const char of pinyin) {
    const mapping = TONE_MARK_MAP[char];
    if (mapping) {
      result += mapping.base;
      tone = mapping.tone;
    } else if (char === ' ' || char === '\t') {
      // End of syllable - append tone number if we have one
      if (tone > 0) {
        result += tone;
        tone = 0;
      }
      result += char;
    } else {
      result += char;
    }
  }

  // Append final tone number if we have one
  if (tone > 0) {
    result += tone;
  }

  return result;
}

/**
 * Converts Chinese characters and pinyin to HTML ruby tags
 * Creates individual ruby elements for each character-syllable pair
 * so pinyin appears centered below each character
 */
function renderPinyinRuby(characters: string, pinyin: string): string {
  if (!pinyin || pinyin.trim() === '') {
    return characters;
  }

  const pinyinSyllables = pinyin.trim().split(/\s+/);
  let syllableIndex = 0;
  let result = '';

  for (const char of characters) {
    // Check if character is Chinese (CJK Unified Ideographs)
    if (/[\u4e00-\u9fff]/.test(char)) {
      const syllable = pinyinSyllables[syllableIndex] || '';
      result += `<ruby>${char}<rt>${syllable}</rt></ruby>`;
      syllableIndex++;
    } else {
      // Punctuation or other characters - no annotation
      result += char;
    }
  }

  return result;
}

/**
 * Parse bracket notation for pinyin (used for speaker names)
 * Example: 张[zhāng]军[jūn] → <ruby>张<rt>zhāng</rt></ruby><ruby>军<rt>jūn</rt></ruby>
 * If useToneNumbers is true, converts tone marks to numbers: zhāng → zhang1
 */
function renderBracketRuby(text: string, useToneNumbers: boolean = false): string {
  const rubyPattern = /([\u4E00-\u9FAF])\[([^\]]+)\]/g;
  return text.replace(rubyPattern, (_match, base, reading) => {
    const displayReading = useToneNumbers ? convertToneMarksToNumbers(reading) : reading;
    return `<ruby>${base}<rt>${displayReading}</rt></ruby>`;
  });
}

export default function ChineseText({
  text,
  metadata,
  className = '',
  showPinyin = true,
}: ChineseTextProps) {
  const { user } = useAuth();

  // Determine which pinyin format to use based on user preference
  const pinyinDisplayMode = user?.pinyinDisplayMode || 'toneMarks';

  // Get the appropriate pinyin format from metadata
  const characters = metadata?.chinese?.characters || text;
  const pinyin =
    pinyinDisplayMode === 'toneNumbers'
      ? metadata?.chinese?.pinyinToneNumbers
      : metadata?.chinese?.pinyinToneMarks;

  // If pinyin is hidden, display plain text (strip bracket notation if present)
  if (!showPinyin) {
    const plainText = text.replace(/\[[^\]]+\]/g, '');
    return <span className={`chinese-text ${className}`}>{plainText}</span>;
  }

  // If no metadata but text has bracket notation (e.g., speaker names), parse it
  if (!metadata?.chinese || !pinyin) {
    if (text.includes('[')) {
      const useToneNumbers = pinyinDisplayMode === 'toneNumbers';
      const htmlContent = renderBracketRuby(text, useToneNumbers);
      return (
        <span
          className={`chinese-text ${className}`}
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      );
    }
    return <span className={`chinese-text ${className}`}>{text}</span>;
  }

  const htmlContent = renderPinyinRuby(characters, pinyin);

  return (
    <span
      className={`chinese-text ${className}`}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
}
