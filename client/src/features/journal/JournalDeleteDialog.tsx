import { useId, useRef, useState } from 'react';
import useJournalModal from './useJournalModal';
import './journalDeleteDialog.css';
import type useJournalArchive from './useJournalArchive';

type Archive = ReturnType<typeof useJournalArchive>;
interface Props {
  entry: Archive['entries'][number];
  remove: Archive['remove'];
  onCancel: () => void;
  onDeleted: (id: string) => void;
}

function useDeletion({ entry, remove, onCancel, onDeleted }: Props) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function confirm() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      if (await remove(entry)) {
        onDeleted(entry.id);
        onCancel();
      } else {
        setError('Could not finish deleting this entry. Check the journal message and try again.');
      }
    } catch {
      setError('Could not delete this entry. Please try again.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return { pending, busy, error, confirm };
}

const JournalDeleteDialog = ({ entry, remove, onCancel, onDeleted }: Props) => {
  const { pending, busy, error, confirm } = useDeletion({ entry, remove, onCancel, onDeleted });
  const dialog = useJournalModal();
  const labelId = useId();
  const descriptionId = useId();
  const kind = entry.version === 0 ? 'draft' : 'entry';

  return (
    <dialog
      ref={dialog}
      aria-labelledby={labelId}
      aria-describedby={descriptionId}
      aria-busy={busy}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending.current) onCancel();
      }}
      className="journal-delete-dialog"
    >
      <h2 id={labelId} className="journal-delete-heading">
        Delete this {kind}?
      </h2>
      <p id={descriptionId} className="journal-delete-description">
        This {kind} will be permanently deleted. You can’t undo this action.
      </p>
      <div className="journal-delete-preview">
        <p className="journal-delete-title">{entry.title || 'Untitled entry'}</p>
        <p className="journal-delete-date">{entry.entryDate}</p>
        <p className="journal-delete-body line-clamp-3">{entry.body || 'Empty draft'}</p>
      </div>
      {error && (
        <p role="alert" className="journal-delete-error">
          {error}
        </p>
      )}
      <div className="journal-delete-actions">
        <button type="button" disabled={busy} onClick={onCancel} className="journal-delete-keep">
          Keep {kind}
        </button>
        <button type="button" disabled={busy} onClick={confirm} className="journal-delete-confirm">
          {busy ? 'Deleting…' : `Delete ${kind}`}
        </button>
      </div>
    </dialog>
  );
};

export default JournalDeleteDialog;
