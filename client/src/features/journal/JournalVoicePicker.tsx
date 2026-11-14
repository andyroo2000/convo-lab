import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Settings2 } from 'lucide-react';
import JournalAvatar from './JournalAvatar';
import type { JournalVoice } from './journalAudio';

interface Props {
  toolbarTarget?: HTMLElement | null;
  voices: JournalVoice[];
  selected: string;
  disabled: boolean;
  onChoose: (id: string) => void;
}

const JournalVoicePicker = ({ voices, selected, disabled, onChoose, toolbarTarget }: Props) => {
  const [choosing, setChoosing] = useState(false);
  const trigger = (
    <button
      type="button"
      aria-label="Narration voice"
      title="Change narration voice"
      aria-expanded={choosing}
      disabled={disabled}
      onClick={() => setChoosing(!choosing)}
      className="flex h-10 w-10 items-center justify-center rounded-lg text-indigo hover:bg-white disabled:opacity-50"
    >
      <Settings2 size={18} aria-hidden="true" />
    </button>
  );
  return (
    <div className="contents">
      {toolbarTarget ? createPortal(trigger, toolbarTarget) : trigger}
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
                aria-label={voice.name}
                aria-pressed={selected === voice.id}
                onClick={() => {
                  onChoose(voice.id);
                  setChoosing(false);
                }}
                className="relative flex flex-col items-center gap-2 rounded-xl border border-gray-200 p-3 text-navy hover:border-indigo hover:bg-indigo/5 focus-visible:outline-indigo disabled:opacity-50"
              >
                <JournalAvatar
                  src={voice.avatarUrl}
                  className="h-20 w-20 rounded-full object-cover"
                />
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
