import { useId, useRef, useState } from 'react';
import useJournalModal from './useJournalModal';
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
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-[22px] border border-gray-200 bg-white p-7 shadow-xl backdrop:bg-midnight/30"
    >
      <h2 id={labelId} className="text-2xl font-semibold text-navy">
        Delete this {kind}?
      </h2>
      <p id={descriptionId} className="mt-3 text-sm text-gray-600">
        This {kind} will be permanently deleted. You can’t undo this action.
      </p>
      <div className="mt-5 rounded-xl border border-indigo/20 bg-indigo/5 p-4">
        <p className="break-words font-medium text-navy">{entry.title || 'Untitled entry'}</p>
        <p className="mt-1 text-xs text-gray-500">{entry.entryDate}</p>
        <p className="mt-3 line-clamp-3 whitespace-pre-wrap break-words text-sm text-midnight">
          {entry.body || 'Empty draft'}
        </p>
      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm text-rose-700">
          {error}
        </p>
      )}
      <div className="mt-7 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="rounded-[10px] border border-gray-200 px-4 py-3 text-sm font-medium text-midnight disabled:opacity-50"
        >
          Keep {kind}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={confirm}
          className="rounded-[10px] bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
        >
          {busy ? 'Deleting…' : `Delete ${kind}`}
        </button>
      </div>
    </dialog>
  );
};

export default JournalDeleteDialog;
