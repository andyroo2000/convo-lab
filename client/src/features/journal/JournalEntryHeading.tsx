import type { JournalDraft } from './types';

const JournalEntryHeading = ({
  draft,
  onEdit,
}: {
  draft: JournalDraft | null;
  onEdit: () => void;
}) => {
  if (!draft) return null;
  return (
    <header className="space-y-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-gray-500">{draft.entryDate}</span>
        <button type="button" className="text-indigo" onClick={onEdit}>
          Edit entry
        </button>
      </div>
      <h1 className="text-3xl font-semibold text-navy">{draft.title || 'Untitled entry'}</h1>
    </header>
  );
};

export default JournalEntryHeading;
