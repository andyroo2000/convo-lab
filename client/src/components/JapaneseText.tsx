import { LanguageMetadata } from '../types';

interface JapaneseTextProps {
  text: string;
  metadata?: LanguageMetadata;
  className?: string;
}

export default function JapaneseText({ text, metadata, className = '' }: JapaneseTextProps) {
  return (
    <span className={`japanese-text ${className}`}>
      {text}
    </span>
  );
}
