import { useState } from 'react';
import JournalDeleteDialog from './JournalDeleteDialog';
import type { JournalDraft } from './types';
import type useJournalArchive from './useJournalArchive';

interface Props {
  draft: JournalDraft;
  disabled?: boolean;
  remove: ReturnType<typeof useJournalArchive>['remove'];
  onDeleted: (id: string) => void;
}

const JournalDeleteAction = ({ draft, disabled = false, remove, onDeleted }: Props) => {
  const [preview, setPreview] = useState<JournalDraft | null>(null);
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        disabled={disabled}
        className="rounded-[10px] border border-rose-200 px-4 py-3 text-sm font-medium text-rose-700 hover:bg-rose-50 focus-visible:ring-2 focus-visible:ring-indigo disabled:opacity-50"
        onClick={() => setPreview(draft)}
      >
        Delete entry
      </button>
      {preview && (
        <JournalDeleteDialog
          entry={{ ...preview, version: preview.expectedVersion }}
          remove={remove}
          onDeleted={onDeleted}
          onCancel={() => setPreview(null)}
        />
      )}
    </>
  );
};

export default JournalDeleteAction;
