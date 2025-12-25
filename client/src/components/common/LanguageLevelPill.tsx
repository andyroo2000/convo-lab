import SegmentedPill from './SegmentedPill';
import type { ColorScheme } from './Pill';

interface LanguageLevelPillProps {
  language: string;
  level: string;
  className?: string;
}

function getLanguageColor(language: string): ColorScheme {
  const colorMap: Record<string, ColorScheme> = {
    ja: 'periwinkle',
    zh: 'keylime',
  };
  return colorMap[language.toLowerCase()] || 'periwinkle';
}

export default function LanguageLevelPill({
  language,
  level,
  className = '',
}: LanguageLevelPillProps) {
  return (
    <SegmentedPill
      leftText={language.toUpperCase()}
      rightText={level}
      leftColor={getLanguageColor(language)}
      rightColor="strawberry"
      className={className}
    />
  );
}
