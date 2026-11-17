import { useQuery } from '@tanstack/react-query';
import findUnfinishedJournal from './findUnfinishedJournal';
import { unfinishedDeviceDraft } from './journalLandingSelection';
import type useJournalArchive from './useJournalArchive';

const JournalResume = ({
  archive,
  ownerId,
  onOpen,
}: {
  archive: ReturnType<typeof useJournalArchive>;
  ownerId: string;
  onOpen: (id: string) => void;
}) => {
  const local = unfinishedDeviceDraft(archive.drafts);
  const entries = archive.entries.filter((entry) => entry.version > 0 && entry.body.trim());
  const query = useQuery({
    queryKey: ['journal-unfinished', ownerId, entries.map(({ id, version }) => [id, version])],
    enabled: !local && !archive.query.isPending,
    retry: false,
    queryFn: ({ signal }) => findUnfinishedJournal(signal),
  });
  const id = local?.id ?? query.data;
  if (!id && query.isError)
    return (
      <div role="status" className="mx-auto w-full max-w-3xl px-5 pt-5 text-sm sm:px-8">
        Couldn’t check saved drafts.{' '}
        <button
          type="button"
          onClick={() => {
            query.refetch().catch(() => undefined);
          }}
        >
          Retry
        </button>
      </div>
    );
  return id ? (
    <div className="mx-auto w-full max-w-3xl px-5 pt-5 sm:px-8">
      <button type="button" className="journal-draft-button" onClick={() => onOpen(id)}>
        Continue draft
      </button>
    </div>
  ) : null;
};
export default JournalResume;
