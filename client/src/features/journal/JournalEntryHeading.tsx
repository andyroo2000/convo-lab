import { Pencil } from 'lucide-react';
import type { JournalDraft } from './types';

const JournalEntryHeading = ({
  draft,
  onEdit,
  nested = false,
}: {
  draft: JournalDraft | null;
  onEdit: () => void;
  nested?: boolean;
}) => {
  if (!draft) return null;
  return (
    <header className="space-y-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-gray-500">{draft.entryDate}</span>
        <button
          type="button"
          aria-label="Edit entry"
          title="Edit entry"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-indigo hover:bg-indigo/5"
          onClick={onEdit}
        >
          <Pencil size={18} aria-hidden="true" />
        </button>
      </div>
      <h1 className="text-3xl font-semibold text-navy">
        {nested ? 'Your reply' : draft.title || 'Untitled entry'}
      </h1>
    </header>
  );
};

export default JournalEntryHeading;
