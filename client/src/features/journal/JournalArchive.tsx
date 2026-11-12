import { Plus } from 'lucide-react';
import JournalArchiveRow from './JournalArchiveRow';
import type useJournalArchive from './useJournalArchive';

type Archive = ReturnType<typeof useJournalArchive>;
interface ArchiveProps {
  archive: Archive;
  selectedId?: string;
  onCreate: () => void;
  onDeleted: (id: string) => void;
}

const JournalArchive = ({ archive, selectedId, onCreate, onDeleted }: ArchiveProps) => (
  <div className="space-y-4 p-5">
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-semibold text-navy">Journal</h1>
      <button type="button" className="btn-primary flex items-center gap-1" onClick={onCreate}>
        <Plus size={18} aria-hidden="true" />
        New entry
      </button>
    </div>
    {archive.error && (
      <p role="alert" className="text-sm text-rose-700">
        {archive.error}
      </p>
    )}
    {archive.query.error && (
      <p role="alert" className="text-sm text-rose-700">
        Saved entries are unavailable. Device drafts are still here.{' '}
        <button
          type="button"
          className="underline"
          onClick={() => {
            archive.query.refetch().catch(() => undefined);
          }}
        >
          Retry
        </button>
      </p>
    )}
    <ul className="space-y-2">
      {archive.entries.map((entry) => (
        <JournalArchiveRow
          key={entry.id}
          entry={entry}
          selected={selectedId === entry.id}
          remove={archive.remove}
          onDeleted={onDeleted}
        />
      ))}
    </ul>
    {archive.query.isLoading && (
      <p role="status" className="text-sm text-gray-500">
        Loading entries…
      </p>
    )}
    {archive.entries.length === 0 && !archive.query.isLoading && (
      <p className="py-8 text-center text-sm text-gray-500">No journal entries yet.</p>
    )}
    {archive.query.hasNextPage && (
      <button
        type="button"
        className="btn-secondary w-full"
        disabled={archive.query.isFetchingNextPage}
        onClick={() => {
          archive.query.fetchNextPage().catch(() => undefined);
        }}
      >
        Load more
      </button>
    )}
  </div>
);

export default JournalArchive;
