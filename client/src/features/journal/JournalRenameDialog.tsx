import { useId, useRef, useState } from 'react';
import useJournalModal from './useJournalModal';
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
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-[22px] border border-gray-200 bg-white p-7 shadow-xl backdrop:bg-[var(--retro-ink)]/30"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          state.save().catch(() => undefined);
        }}
      >
        <h2 id={headingId} className="text-2xl font-semibold text-navy">
          Rename entry
        </h2>
        <input
          aria-label="Entry title"
          placeholder="Untitled entry"
          value={state.title}
          disabled={state.busy}
          onFocus={(event) => event.target.select()}
          onChange={(event) => state.setTitle(event.target.value)}
          className="mt-6 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-navy focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/20"
        />
        {state.error && (
          <p role="alert" className="mt-4 text-sm text-rose-700">
            {state.error}
          </p>
        )}
        {[...state.title.trim()].length > 255 && (
          <p className="mt-3 text-sm text-rose-700">Use 255 characters or fewer.</p>
        )}
        <div className="mt-7 flex justify-end gap-3">
          <button
            type="button"
            disabled={state.busy}
            onClick={onCancel}
            className="rounded-[10px] border border-gray-200 px-5 py-3 text-sm font-medium text-[var(--retro-ink)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={state.busy || !state.valid}
            className="rounded-[10px] bg-[var(--retro-ink)] px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {state.busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </dialog>
  );
};

export default JournalRenameDialog;
