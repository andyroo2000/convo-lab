import { LanguageMetadata } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface ChineseTextProps {
  text: string;
  metadata?: LanguageMetadata;
  className?: string;
}

/**
 * Converts Chinese characters and pinyin to HTML ruby tags
 * Displays pinyin above characters based on user's display mode preference
 */
function renderPinyinRuby(characters: string, pinyin: string): string {
  // Split characters and pinyin by whitespace
  const charArray = characters.split('');
  const pinyinArray = pinyin.split(' ');

  // If pinyin array is shorter, we may need to map syllables to characters
  // For simplicity, we'll display the full pinyin above the character sequence
  // A more sophisticated approach would map each pinyin syllable to its character(s)

  if (!pinyin || pinyin.trim() === '') {
    // No pinyin available, just return the characters
    return characters;
  }

  // Create ruby tags with full pinyin above the text
  // For better readability, we'll show pinyin above the entire phrase
  return `<ruby>${characters}<rt style="font-size: 0.6em;">${pinyin}</rt></ruby>`;
}

export default function ChineseText({ text, metadata, className = '' }: ChineseTextProps) {
  const { user } = useAuth();

  // Determine which pinyin format to use based on user preference
  const pinyinDisplayMode = user?.pinyinDisplayMode || 'toneMarks';

  // Get the appropriate pinyin format from metadata
  const characters = metadata?.chinese?.characters || text;
  const pinyin = pinyinDisplayMode === 'toneNumbers'
    ? metadata?.chinese?.pinyinToneNumbers
    : metadata?.chinese?.pinyinToneMarks;

  // If no metadata or pinyin, just display plain text
  if (!metadata?.chinese || !pinyin) {
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
