import { useEffect, useRef, useState, type ReactNode } from 'react';
import JournalPaper from './JournalPaper';
import JournalWritingField from './JournalWritingField';
import type { JournalDocumentControls } from './useJournalDocument';
import './journalDraftActions.css';

interface Props {
  text: string;
  revision: number;
  controls: JournalDocumentControls;
  onClose: () => void;
  heading?: ReactNode;
}

function canSave(text: string, busy: boolean) {
  return !busy && text.trim().length > 0;
}

const JournalFinalEditor = ({ text, revision, controls, onClose, heading }: Props) => {
  const [value, setValue] = useState(text);
  const field = useRef<HTMLTextAreaElement>(null);
  const pending = useRef(false);
  useEffect(() => {
    field.current?.focus();
  }, []);
  async function save() {
    if (pending.current || controls.busy) return;
    if (value === text) {
      onClose();
      return;
    }
    pending.current = true;
    try {
      if (await controls.change({ text: value }, revision)) onClose();
    } finally {
      pending.current = false;
    }
  }
  return (
    <form
      className="space-y-4"
      aria-label="Edit final version"
      onSubmit={(event) => {
        event.preventDefault();
        save().catch(() => undefined);
      }}
    >
      <JournalPaper heading={heading}>
        <JournalWritingField
          className="journal-writing-field--paper"
          fieldRef={field}
          aria-label="Final text"
          value={value}
          maxLength={30000}
          disabled={controls.busy}
          onChange={(event) => setValue(event.target.value)}
        />
      </JournalPaper>
      {controls.error && (
        <p role="alert" className="text-sm text-rose-700">
          {controls.error}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          className="journal-draft-button"
          disabled={controls.busy}
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="journal-draft-button journal-draft-button--sage"
          disabled={!canSave(value, controls.busy)}
        >
          {controls.busy ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
};
export default JournalFinalEditor;
