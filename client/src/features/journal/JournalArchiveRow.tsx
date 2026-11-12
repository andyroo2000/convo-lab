import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import type useJournalArchive from './useJournalArchive';

type Archive = ReturnType<typeof useJournalArchive>;
interface RowProps {
  entry: Archive['entries'][number];
  selected: boolean;
  remove: Archive['remove'];
  onDeleted: (id: string) => void;
}

const JournalArchiveRow = ({ entry, selected, remove, onDeleted }: RowProps) => {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const title = entry.title || 'Untitled entry';
  async function deleteEntry() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setBusy(true);
    const deleted = await remove(entry);
    setBusy(false);
    if (deleted) onDeleted(entry.id);
  }
  return (
    <li
      className={`group rounded-xl border ${selected ? 'border-indigo/30 bg-indigo/5' : 'border-gray-100 bg-white'}`}
    >
      <div className="flex items-center">
        <Link
          to={`/app/journal/${entry.id}`}
          aria-current={selected ? 'page' : undefined}
          className="min-w-0 flex-1 rounded-xl p-4 focus-visible:ring-2 focus-visible:ring-indigo"
        >
          <span className="block truncate font-medium text-navy">{title}</span>
          <span className="mt-1 block text-xs text-gray-500">{entry.entryDate}</span>
        </Link>
        <button
          type="button"
          aria-label={`Delete ${title}`}
          aria-expanded={confirming}
          disabled={busy}
          className="mr-2 rounded-lg p-2 text-gray-400 hover:bg-rose-50 hover:text-rose-700"
          onClick={() => {
            deleteEntry().catch(() => setBusy(false));
          }}
        >
          {confirming ? (
            <span className="text-sm text-rose-700">Confirm</span>
          ) : (
            <Trash2 size={16} aria-hidden="true" />
          )}
        </button>
      </div>
      {confirming && (
        <div className="flex items-center justify-between px-4 pb-3 text-sm">
          <span>Delete this entry?</span>
          <button
            type="button"
            className="text-indigo"
            onClick={() => setConfirming(false)}
            disabled={busy}
          >
            Cancel
          </button>
        </div>
      )}
    </li>
  );
};

export default JournalArchiveRow;
