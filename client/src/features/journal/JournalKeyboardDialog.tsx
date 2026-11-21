import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Keyboard, X } from 'lucide-react';
import useDialogDismissal from '../../hooks/useDialogDismissal';
import { saveKeyboardMode, useKeyboardMode, type KeyboardMode } from './journalKeyboardPreference';
import './journalKeyboard.css';
import './journalEntryDialogs.css';

export default function JournalKeyboardDialog({
  opener,
  onClose,
}: {
  opener: HTMLElement;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const mode = useKeyboardMode();
  const [choice, setChoice] = useState<KeyboardMode>(mode ?? 'built-in');
  useDialogDismissal(dialog);
  useEffect(() => {
    opener.focus({ preventScroll: true });
    dialog.current?.showModal();
  }, [opener]);
  return createPortal(
    <dialog
      ref={dialog}
      className="journal-entry-dialog journal-keyboard-dialog"
      aria-labelledby="journal-keyboard-heading"
      onClose={onClose}
    >
      <header className="journal-choice-header">
        <h2 id="journal-keyboard-heading">How would you like to type?</h2>
        <button
          type="button"
          className="journal-choice-close"
          aria-label="Close keyboard settings"
          onClick={() => dialog.current?.close()}
        >
          <X size={20} />
        </button>
      </header>
      <div className="journal-keyboard-options">
        {(['built-in', 'device'] as const).map((value) => (
          <button
            key={value}
            type="button"
            className="journal-keyboard-option"
            aria-pressed={choice === value}
            onClick={() => setChoice(value)}
          >
            <span className="journal-keyboard-symbol" aria-hidden="true">
              {value === 'built-in' ? 'あ' : <Keyboard size={22} />}
            </span>
            <span>
              <strong>
                {value === 'built-in' ? 'Built-in Japanese input' : 'Use my keyboard'}
              </strong>
              <small>
                {value === 'built-in'
                  ? 'Type romaji with your English keyboard.'
                  : 'Use your computer’s Japanese keyboard.'}
              </small>
            </span>
            <Check size={18} className={choice === value ? '' : 'invisible'} aria-hidden="true" />
          </button>
        ))}
      </div>
      <button
        type="button"
        className="journal-draft-button journal-draft-button--sage journal-keyboard-done"
        onClick={() => {
          saveKeyboardMode(choice);
          dialog.current?.close();
        }}
      >
        Done
      </button>
    </dialog>,
    document.body
  );
}
