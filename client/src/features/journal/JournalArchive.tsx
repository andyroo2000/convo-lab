import type { ReactNode } from 'react';
import { SquarePen } from 'lucide-react';
import JournalArchiveRow from './JournalArchiveRow';
import type useJournalArchive from './useJournalArchive';

type Archive = ReturnType<typeof useJournalArchive>;
interface ArchiveProps {
  archive: Archive;
  selectedId?: string;
  onCreate: () => void;
  appearance?: ReactNode;
}

const ArchiveContents = ({ archive, selectedId }: Pick<ArchiveProps, 'archive' | 'selectedId'>) => (
  <>
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
        <JournalArchiveRow key={entry.id} entry={entry} selected={selectedId === entry.id} />
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
  </>
);

const JournalArchive = ({ archive, selectedId, onCreate, appearance }: ArchiveProps) => (
  <div className="space-y-4 p-5">
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-semibold text-navy">Journal</h1>
      <div className="flex items-center gap-2">
        {appearance}
        <button
          type="button"
          aria-label="New entry"
          title="New entry"
          className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-indigo/5 text-indigo hover:bg-indigo/10"
          onClick={onCreate}
        >
          <SquarePen size={23} strokeWidth={1.7} aria-hidden="true" />
        </button>
      </div>
    </div>
    <div className={selectedId ? 'hidden space-y-4 md:block' : 'space-y-4'}>
      <ArchiveContents archive={archive} selectedId={selectedId} />
    </div>
  </div>
);

export default JournalArchive;
