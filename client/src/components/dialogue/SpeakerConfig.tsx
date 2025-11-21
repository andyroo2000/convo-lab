import { ProficiencyLevel, ToneStyle, LanguageCode } from '../../types';
import { TTS_VOICES } from '../../../../shared/src/constants';
import JapaneseText from '../JapaneseText';

interface SpeakerConfigProps {
  name: string;
  voiceId: string;
  proficiency: ProficiencyLevel;
  tone: ToneStyle;
  color: string;
  targetLanguage: LanguageCode;
  onUpdate: (field: string, value: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}

const PROFICIENCY_OPTIONS: { value: ProficiencyLevel; label: string; description: string }[] = [
  { value: 'beginner', label: 'Beginner', description: 'Simple grammar, basic vocabulary' },
  { value: 'intermediate', label: 'Intermediate', description: 'Common phrases, everyday expressions' },
  { value: 'advanced', label: 'Advanced', description: 'Complex sentences, nuanced language' },
  { value: 'native', label: 'Native', description: 'Natural speech, idioms, slang' },
];

const TONE_OPTIONS: { value: ToneStyle; label: string; description: string }[] = [
  { value: 'casual', label: 'Casual', description: 'Informal, friendly' },
  { value: 'polite', label: 'Polite', description: 'Standard respectful' },
  { value: 'formal', label: 'Formal', description: 'Very respectful, business' },
];

const SPEAKER_COLORS = ['#5E6AD8', '#4EA6B1', '#FF6A6A', '#A6F2C2', '#FFB84D', '#D896FF'];

export default function SpeakerConfig({
  name,
  voiceId,
  proficiency,
  tone,
  color,
  targetLanguage,
  onUpdate,
  onRemove,
  canRemove,
}: SpeakerConfigProps) {
  // Get available voices for the target language
  const availableVoices = TTS_VOICES[targetLanguage as keyof typeof TTS_VOICES]?.voices || [];
  return (
    <div className="card relative">
      {/* Color indicator */}
      <div
        className="absolute top-0 left-0 w-2 h-full rounded-l-xl"
        style={{ backgroundColor: color }}
      />

      <div className="pl-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-navy mb-2">
              Speaker Name
            </label>
            <div className="px-4 py-2 bg-gray-50 border border-warm-gray rounded-lg text-navy text-lg">
              <JapaneseText text={name} />
            </div>
          </div>
          {canRemove && (
            <button
              onClick={onRemove}
              className="ml-4 mt-7 text-red-500 hover:text-red-700 transition-colors"
              title="Remove speaker"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Voice Selection */}
          <div>
            <label className="block text-sm font-medium text-navy mb-2">
              Voice
            </label>
            <select
              value={voiceId}
              onChange={(e) => onUpdate('voiceId', e.target.value)}
              className="input"
            >
              {availableVoices.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  ({voice.gender === 'male' ? 'M' : 'F'}) {voice.description}
                </option>
              ))}
            </select>
            {/* Voice Sample Player */}
            {voiceId && (() => {
              const selectedVoice = availableVoices.find(v => v.id === voiceId);
              if (selectedVoice) {
                const voiceName = selectedVoice.description.split(' - ')[0].toLowerCase();
                return (
                  <audio
                    key={voiceId}
                    controls
                    className="w-full mt-2 h-8"
                    style={{ maxHeight: '32px' }}
                  >
                    <source src={`/voice-samples/${voiceName}.mp3`} type="audio/mpeg" />
                    Your browser does not support the audio element.
                  </audio>
                );
              }
              return null;
            })()}
          </div>

          {/* Proficiency Level */}
          <div>
            <label className="block text-sm font-medium text-navy mb-2">
              Proficiency Level
            </label>
            <select
              value={proficiency}
              onChange={(e) => onUpdate('proficiency', e.target.value)}
              className="input"
            >
              {PROFICIENCY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {PROFICIENCY_OPTIONS.find(o => o.value === proficiency)?.description}
            </p>
          </div>

          {/* Tone */}
          <div>
            <label className="block text-sm font-medium text-navy mb-2">
              Tone
            </label>
            <select
              value={tone}
              onChange={(e) => onUpdate('tone', e.target.value)}
              className="input"
            >
              {TONE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {TONE_OPTIONS.find(o => o.value === tone)?.description}
            </p>
          </div>
        </div>

        {/* Color Picker */}
        <div>
          <label className="block text-sm font-medium text-navy mb-2">
            Display Color
          </label>
          <div className="flex gap-2">
            {SPEAKER_COLORS.map((colorOption) => (
              <button
                key={colorOption}
                onClick={() => onUpdate('color', colorOption)}
                className={`w-8 h-8 rounded-full transition-all ${
                  color === colorOption
                    ? 'ring-2 ring-offset-2 ring-indigo scale-110'
                    : 'hover:scale-105'
                }`}
                style={{ backgroundColor: colorOption }}
                title={colorOption}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
