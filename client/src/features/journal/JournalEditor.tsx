import type { ReactNode } from 'react';
import useJournalEditor from './useJournalEditor';
import useJournalAnalysis from './useJournalAnalysis';
import JournalEditorForm from './JournalEditorForm';
import { EditorMessages, FeedbackStatus } from './JournalEditorMessages';
import type { JournalAnalysis, JournalEntry } from './types';

interface JournalEditorProps {
  ownerId: string;
  entryId: string;
  onSaved: (entry: JournalEntry) => void;
  onOpen: (id: string) => void;
  renderFeedback?: (analysis: JournalAnalysis) => ReactNode;
}

type Editor = ReturnType<typeof useJournalEditor>;

function currentFeedback(editor: Editor, analysis: ReturnType<typeof useJournalAnalysis>) {
  if (analysis.data?.entry.body !== editor.draft?.body) return null;
  return analysis.data?.data;
}

function isProcessing(analysis: JournalAnalysis | null | undefined) {
  return analysis?.status === 'queued' || analysis?.status === 'processing';
}

const JournalEditor = ({
  ownerId,
  entryId,
  onSaved,
  onOpen,
  renderFeedback,
}: JournalEditorProps) => {
  const editor = useJournalEditor({ ownerId, entryId, onSaved });
  const analysis = useJournalAnalysis({
    ownerId,
    entryId,
    submitted: editor.submitted,
    submission: editor.submission,
    enabled: Boolean(editor.draft?.expectedVersion),
    onEntry: editor.acceptGeneratedEntry,
  });
  const current = currentFeedback(editor, analysis);
  const processing = isProcessing(current);

  return (
    <article className="mx-auto w-full max-w-3xl space-y-6 p-5 sm:p-8">
      <EditorMessages editor={editor} onOpen={onOpen} />
      <JournalEditorForm editor={editor} processing={processing} />
      <FeedbackStatus
        analysis={analysis}
        current={current}
        retry={() => {
          analysis.refetch().catch(() => undefined);
        }}
      />
      {current?.status === 'ready' && renderFeedback?.(current)}
    </article>
  );
};

export default JournalEditor;
