import SegmentedPill from './SegmentedPill';

interface LanguageLevelPillProps {
  language: string;
  level: string;
}

export default function LanguageLevelPill({ language, level }: LanguageLevelPillProps) {
  return (
    <SegmentedPill
      leftText={language.toUpperCase()}
      rightText={level}
      leftColor="periwinkle"
      rightColor="strawberry"
    />
  );
}
