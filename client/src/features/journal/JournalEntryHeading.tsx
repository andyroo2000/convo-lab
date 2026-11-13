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
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-gray-500">{draft.entryDate}</span>
      </div>
      <Heading className="text-3xl font-semibold text-navy">
        {nested ? 'Your reply' : draft.title || 'Untitled entry'}
      </Heading>
    </header>
  );
};

export default JournalEntryHeading;
