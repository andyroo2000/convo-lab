import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { Check, Settings2, X } from 'lucide-react';
import useDialogDismissal from '../../hooks/useDialogDismissal';
import JournalAvatar from './JournalAvatar';
import type { JournalVoice } from './journalAudio';
import './journalEntryDialogs.css';
import './journalChoicePicker.css';

interface Props {
  toolbarTarget?: HTMLElement | null;
  voices: JournalVoice[];
  selected: string;
  disabled: boolean;
  onChoose: (id: string) => void;
}

const JournalVoicePicker = ({ voices, selected, disabled, onChoose, toolbarTarget }: Props) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const openDialog = useDialogDismissal(dialog);
  const trigger = (
    <button
      type="button"
      aria-label="Narration voice"
      title="Change narration voice"
      aria-haspopup="dialog"
      disabled={disabled}
      onClick={(event) => openDialog(event.currentTarget)}
      className="journal-menu-item"
    >
      <Settings2 size={18} aria-hidden="true" /> Narration voice
    </button>
  );
  return (
    <div className="contents">
      {toolbarTarget ? createPortal(trigger, toolbarTarget) : trigger}
      {createPortal(
        <dialog
          ref={dialog}
          aria-label="Choose your narration voice"
          className="journal-entry-dialog journal-choice-dialog"
        >
          <div className="journal-choice-header">
            <h3 className="journal-entry-dialog-heading">Narration voice</h3>
            <button
              type="button"
              className="journal-choice-close"
              aria-label="Cancel"
              onClick={() => dialog.current?.close()}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <p className="journal-choice-description">Used when you play the corrected version.</p>
          <div className="journal-choice-options">
            {voices.map((voice) => (
              <button
                key={voice.id}
                type="button"
                disabled={disabled}
                aria-label={voice.name}
                aria-pressed={selected === voice.id}
                onClick={() => {
                  onChoose(voice.id);
                  dialog.current?.close();
                }}
                className="journal-choice-option"
              >
                <JournalAvatar src={voice.avatarUrl} className="journal-choice-avatar" />
                {selected === voice.id && (
                  <Check size={16} className="journal-choice-check" aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
        </dialog>,
        document.body
      )}
    </div>
  );
};

export default JournalVoicePicker;
