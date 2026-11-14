import type { JournalDraft } from './types';

const JournalEntryHeading = ({
  draft,
  nested = false,
}: {
  draft: JournalDraft | null;
  nested?: boolean;
}) => {
  if (!draft) return null;
  const Heading = nested ? 'h2' : 'h1';
  return (
    <header className="space-y-3">
      <Heading className="text-3xl font-semibold text-navy">
        {nested ? 'Your reply' : draft.title || 'Untitled entry'}
      </Heading>
      <time
        dateTime={draft.entryDate}
        className="block text-[15px] font-normal leading-[1.6] tabular-nums text-[#a3aab6]"
      >
        {draft.entryDate?.replace(/-/g, '.')}
      </time>
    </header>
  );
};

export default JournalEntryHeading;
