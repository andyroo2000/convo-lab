import { useState } from 'react';
import { Check, Settings2, UserRound } from 'lucide-react';
import type { JournalVoice } from './journalAudio';

interface Props {
  voices: JournalVoice[];
  selected: string;
  disabled: boolean;
  onChoose: (id: string) => void;
}

const JournalVoicePicker = ({ voices, selected, disabled, onChoose }: Props) => {
  const [choosing, setChoosing] = useState(false);
  return (
    <div className="contents">
      <button
        type="button"
        aria-label="Narration voice"
        title="Change narration voice"
        aria-expanded={choosing}
        disabled={disabled}
        onClick={() => setChoosing(!choosing)}
        className="ml-auto flex h-10 w-10 items-center justify-center rounded-lg text-indigo hover:bg-white disabled:opacity-50"
      >
        <Settings2 size={18} aria-hidden="true" />
      </button>
      {choosing && (
        <section
          aria-label="Choose your narration voice"
          className="w-full rounded-2xl border border-gray-200 bg-white p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-navy">Choose your narration voice</h3>
            <button
              type="button"
              className="text-sm text-indigo"
              onClick={() => setChoosing(false)}
            >
              Cancel
            </button>
          </div>
          <p className="mt-1 text-sm text-gray-600">Used when you play the corrected version.</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {voices.map((voice) => (
              <button
                key={voice.id}
                type="button"
                disabled={disabled}
                aria-pressed={selected === voice.id}
                onClick={() => {
                  onChoose(voice.id);
                  setChoosing(false);
                }}
                className="relative flex flex-col items-center gap-2 rounded-xl border border-gray-200 p-3 text-navy hover:border-indigo hover:bg-indigo/5 focus-visible:outline-indigo disabled:opacity-50"
              >
                {voice.avatarUrl ? (
                  <img
                    src={voice.avatarUrl}
                    alt=""
                    className="h-20 w-20 rounded-full object-cover"
                  />
                ) : (
                  <UserRound className="h-20 w-20" aria-hidden="true" />
                )}
                <span className="font-medium">{voice.name}</span>
                {selected === voice.id && (
                  <Check
                    size={16}
                    className="absolute right-2 top-2 text-indigo"
                    aria-hidden="true"
                  />
                )}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default JournalVoicePicker;
