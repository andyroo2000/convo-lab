import { LanguageMetadata } from '../types';

interface JapaneseTextProps {
  text: string;
  metadata?: LanguageMetadata;
  className?: string;
  showFurigana?: boolean;
}

/**
 * Converts bracket notation to HTML ruby tags
 * Input: "買[か]い物[もの]" or "お正月休み[おしょうがつやすみ]"
 * Output: "<ruby>買<rt>か</rt></ruby>い<ruby>物<rt>もの</rt></ruby>"
 */
function renderRuby(text: string): string {
  // Pattern matches kanji OR mixed kanji/hiragana followed by bracket notation
  // Handles: "買[か]", "鈴木[すずき]", "お正月休み[おしょうがつやすみ]"
  // [\u4E00-\u9FAF\u3040-\u309F]+ matches kanji and hiragana characters
  const rubyPattern = /([\u4E00-\u9FAF\u3040-\u309F]+)\[([^\]]+)\]/g;

  return text.replace(rubyPattern, (match, base, reading) => {
    // Remove extra spaces from the reading that might have been added during generation
    const cleanReading = reading.replace(/\s+/g, '');
    return `<ruby>${base}<rt>${cleanReading}</rt></ruby>`;
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
