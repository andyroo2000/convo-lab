import JournalEditor from './JournalEditor';
import JournalConversation from './JournalConversation';
import type { JournalDraft, JournalEntry } from './types';

const JournalEntryContent = ({
  ownerId,
  entryId,
  initialDraft,
  onSaved,
  onOpen,
  onClose,
  onBusyChange,
}: {
  ownerId: string;
  entryId: string;
  initialDraft?: JournalDraft;
  onSaved: (entry: JournalEntry) => void;
  onOpen: (id: string) => void;
  onClose: () => void;
  onBusyChange: (busy: boolean) => void;
}) => (
  <JournalEditor
    ownerId={ownerId}
    entryId={entryId}
    initialDraft={initialDraft}
    onSaved={onSaved}
    onOpen={onOpen}
    onClose={onClose}
    onBusyChange={onBusyChange}
    renderFeedback={(analysis, heading) => (
      <JournalConversation
        key={analysis.id}
        ownerId={ownerId}
        entryId={entryId}
        analysis={analysis}
        heading={heading}
        onOpen={onOpen}
        onClose={onClose}
      />
    )}
  />
);
export default JournalEntryContent;
