import { useEffect, useState, type ComponentProps } from 'react';
import { newJournalDraft } from './journalDrafts';
import todayJournalEntry from './journalLandingSelection';
import JournalEntryContent from './JournalEntryContent';
import type useJournalArchive from './useJournalArchive';

type Props = Omit<ComponentProps<typeof JournalEntryContent>, 'entryId' | 'initialDraft'> & {
  archive: ReturnType<typeof useJournalArchive>;
  blank: boolean;
  onSelectToday: (id: string) => void;
  onActiveDraft?: (id: string | undefined) => void;
};

const JournalLanding = ({ archive, blank, onSelectToday, onActiveDraft, ...editor }: Props) => {
  const [draft] = useState(newJournalDraft);
  const [resolved, setResolved] = useState(blank);
  useEffect(() => {
    onActiveDraft?.(draft.id);
    return () => onActiveDraft?.(undefined);
  }, [draft.id, onActiveDraft]);
  // Automatically reopen a synced draft only when it is in the available online list.
  // All local writing remains accessible through Contents, including while offline.
  const onlinePages =
    archive.query.isSuccess && archive.query.fetchStatus !== 'paused'
      ? archive.query.data.pages
      : undefined;
  useEffect(() => {
    if (resolved || archive.query.isPending) return;
    const today = todayJournalEntry(archive.entries, draft.entryDate, onlinePages);
    setResolved(true);
    if (today) onSelectToday(today.id);
  }, [
    resolved,
    archive.query.isPending,
    archive.entries,
    draft.entryDate,
    onSelectToday,
    onlinePages,
  ]);
  if (!resolved)
    return (
      <p className="p-8 text-gray-500" role="status">
        Opening Journal…
      </p>
    );
  return <JournalEntryContent {...editor} entryId={draft.id} initialDraft={draft} />;
};
export default JournalLanding;
