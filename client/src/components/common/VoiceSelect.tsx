import { TTS_VOICES } from '@languageflow/shared/src/constants-new';

import VoicePreview from './VoicePreview';

type VoiceLanguage = keyof typeof TTS_VOICES;

interface VoiceSelectProps {
  disabled?: boolean;
  id: string;
  label: string;
  language: VoiceLanguage;
  onChange: (voiceId: string) => void;
  value: string;
}

const VoiceSelect = ({
  disabled = false,
  id,
  label,
  language,
  onChange,
  value,
}: VoiceSelectProps) => {
  const voices = TTS_VOICES[language]?.voices ?? [];
  const hasVoices = voices.length > 0;
  const hasSelectedVoice = voices.some((voice) => voice.id === value);
  const hasUnavailableSelection = hasVoices && Boolean(value) && !hasSelectedVoice;

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-gray-700">
        {label}
      </label>
      <select
        id={id}
        value={hasVoices ? value : ''}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled || !hasVoices}
        className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700 disabled:bg-gray-100"
      >
        {hasUnavailableSelection ? (
          <option value={value} disabled>
            Selected voice unavailable
          </option>
        ) : null}
        {hasVoices ? (
          voices.map((voice) => (
            <option key={voice.id} value={voice.id}>
              ({voice.gender === 'male' ? 'M' : 'F'}) {voice.description}
            </option>
          ))
        ) : (
          <option value="">No voices available</option>
        )}
      </select>
      {hasUnavailableSelection ? (
        <p className="mt-2 text-xs text-red-600">Selected voice is not available.</p>
      ) : null}
      {hasSelectedVoice ? <VoicePreview voiceId={value} /> : null}
    </div>
  );
};

export default VoiceSelect;
