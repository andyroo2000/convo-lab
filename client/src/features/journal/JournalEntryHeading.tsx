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
      <time dateTime={draft.entryDate} className="block text-sm text-gray-500">
        {draft.entryDate}
      </time>
    </header>
  );
};

export default JournalEntryHeading;
