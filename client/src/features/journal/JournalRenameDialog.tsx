import { useId, useRef, useState } from 'react';
import useJournalModal from './useJournalModal';
import './journalEntryDialogs.css';
import type useJournalArchive from './useJournalArchive';

type Archive = ReturnType<typeof useJournalArchive>;
interface Props {
  entry: Archive['entries'][number];
  rename: Archive['rename'];
  onCancel: () => void;
  onRenamed: (id: string) => void;
}

function useRename({ entry, rename, onCancel, onRenamed }: Props) {
  const [title, setTitle] = useState(entry.title ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const valid = title.trim().length > 0 && [...title.trim()].length <= 255;
  async function save() {
    if (pending.current || !valid) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await rename(entry, title);
      onRenamed(entry.id);
      onCancel();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not rename this entry. Try again.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return { title, setTitle, busy, error, pending, valid, save };
}

const JournalRenameDialog = ({ entry, rename, onCancel, onRenamed }: Props) => {
  const state = useRename({ entry, rename, onCancel, onRenamed });
  const dialog = useJournalModal();
  const headingId = useId();
  return (
    <dialog
      ref={dialog}
      aria-labelledby={headingId}
      aria-busy={state.busy}
      onCancel={(event) => {
        event.preventDefault();
        if (!state.pending.current) onCancel();
      }}
      className="journal-entry-dialog"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          state.save().catch(() => undefined);
        }}
      >
        <h2 id={headingId} className="journal-entry-dialog-heading">
          Rename entry
        </h2>
        <input
          aria-label="Entry title"
          placeholder="Untitled entry"
          value={state.title}
          disabled={state.busy}
          onFocus={(event) => event.target.select()}
          onChange={(event) => state.setTitle(event.target.value)}
          className="journal-entry-dialog-input"
        />
        {state.error && (
          <p role="alert" className="journal-entry-dialog-error">
            {state.error}
          </p>
        )}
        {[...state.title.trim()].length > 255 && (
          <p className="journal-entry-dialog-error">Use 255 characters or fewer.</p>
        )}
        <div className="journal-entry-dialog-actions">
          <button
            type="button"
            disabled={state.busy}
            onClick={onCancel}
            className="journal-entry-dialog-cancel"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={state.busy || !state.valid}
            className="journal-entry-dialog-save"
          >
            {state.busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </dialog>
  );
};

export default JournalRenameDialog;
