import { useEffect, useState, type ComponentProps } from 'react';
import { newJournalDraft } from './journalDrafts';
import { todayJournalEntry } from './journalLandingSelection';
import JournalEntryContent from './JournalEntryContent';
import JournalResume from './JournalResume';
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
  const [writing, setWriting] = useState(false);
  useEffect(() => {
    onActiveDraft?.(draft.id);
    return () => onActiveDraft?.(undefined);
  }, [draft.id, onActiveDraft]);
  useEffect(() => {
    if (resolved || archive.query.isPending) return;
    const today = todayJournalEntry(archive.entries, draft.entryDate);
    setResolved(true);
    if (today) onSelectToday(today.id);
  }, [resolved, archive.query.isPending, archive.entries, draft.entryDate, onSelectToday]);
  if (!resolved)
    return (
      <p className="p-8 text-gray-500" role="status">
        Opening Journal…
      </p>
    );
  return (
    <div>
      {!writing && (
        <JournalResume archive={archive} ownerId={editor.ownerId} onOpen={editor.onOpen} />
      )}
      <JournalEntryContent
        {...editor}
        entryId={draft.id}
        initialDraft={draft}
        onWritingChange={setWriting}
      />
    </div>
  );
};
export default JournalLanding;
