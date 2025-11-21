import { LanguageMetadata } from '../types';

interface JapaneseTextProps {
  text: string;
  metadata?: LanguageMetadata;
  className?: string;
  showFurigana?: boolean;
}

/**
 * Converts bracket notation to HTML ruby tags
 * Input: "買[か]い物[もの]"
 * Output: "<ruby>買<rt>か</rt></ruby>い<ruby>物<rt>もの</rt></ruby>"
 */
function renderRuby(text: string): string {
  // Pattern matches Japanese characters (hiragana, katakana, kanji, wave dash, prolonged sound mark)
  // followed by bracket notation containing the reading
  // Example: "買[か]い物[もの]" -> "<ruby>買<rt>か</rt></ruby>い<ruby>物<rt>もの</rt></ruby>"
  const rubyPattern = /([\u4E00-\u9FAF]+)\[([^\]]+)\]/g;

  return text.replace(rubyPattern, (match, base, reading) => {
    return `<ruby>${base}<rt>${reading}</rt></ruby>`;
  });
}

export default function JapaneseText({ text, metadata, className = '', showFurigana = true }: JapaneseTextProps) {
  // If showFurigana is false, use plain kanji text without readings
  // Otherwise use furigana from metadata if available
  const displayText = showFurigana
    ? (metadata?.japanese?.furigana || text)
    : (metadata?.japanese?.kanji || text);

  const htmlContent = showFurigana ? renderRuby(displayText) : displayText;

  return (
    <span
      className={`japanese-text ${className}`}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
}
