import { LanguageCode } from '../../types';
import JapaneseText from '../JapaneseText';

interface SpeakerConfigProps {
  name: string;
  targetLanguage: LanguageCode;
}

export default function SpeakerConfig({ name, targetLanguage }: SpeakerConfigProps) {
  return (
    <div className="px-4 py-3 bg-gray-50 border border-warm-gray rounded-lg text-navy text-lg">
      <JapaneseText text={name} />
    </div>
  );
}
