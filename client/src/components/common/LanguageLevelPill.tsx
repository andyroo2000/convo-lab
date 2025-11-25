import SegmentedPill from './SegmentedPill';

interface LanguageLevelPillProps {
  language: string;
  level: string;
  className?: string;
}

export default function LanguageLevelPill({ language, level, className = '' }: LanguageLevelPillProps) {
  return (
    <SegmentedPill
      leftText={language.toUpperCase()}
      rightText={level}
      leftColor="periwinkle"
      rightColor="strawberry"
      className={className}
    />
  );
}
