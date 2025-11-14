import { LanguageMetadata } from '../types';

interface JapaneseTextProps {
  text: string;
  metadata?: LanguageMetadata;
  className?: string;
}

/**
 * Converts bracket notation to HTML ruby tags
 * Input: "買[か]い物[もの]"
 * Output: "<ruby>買<rt>か</rt></ruby>い<ruby>物<rt>もの</rt></ruby>"
 */
function renderRuby(text: string): string {
  // Pattern matches: Kanji[Kana] with optional hiragana after kanji
  const rubyPattern = /([\u4E00-\u9FAF]+)(?:[\u3040-\u309F\u30A0-\u30FF]*)\[([^\]]+)\]/g;

  return text.replace(rubyPattern, (match, kanji, reading) => {
    // Extract just the kanji part for the ruby base
    const kanjiMatch = match.match(/^([\u4E00-\u9FAF]+)/);
    const hiraganaAfter = match.match(/[\u3040-\u309F\u30A0-\u30FF]+(?=\[)/);

    const kanjiOnly = kanjiMatch ? kanjiMatch[1] : kanji;
    const hiraganaSuffix = hiraganaAfter ? hiraganaAfter[0] : '';

    return `<ruby>${kanjiOnly}<rt>${reading}</rt></ruby>${hiraganaSuffix}`;
  });
}

export default function JapaneseText({ text, metadata, className = '' }: JapaneseTextProps) {
  // Use furigana from metadata if available, otherwise use plain text
  const displayText = metadata?.japanese?.furigana || text;
  const htmlContent = renderRuby(displayText);

  return (
    <span
      className={`japanese-text ${className}`}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
}
