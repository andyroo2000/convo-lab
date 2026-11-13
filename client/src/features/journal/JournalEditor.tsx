import { useState, type ReactNode } from 'react';
import useJournalEditor from './useJournalEditor';
import useJournalAnalysis from './useJournalAnalysis';
import JournalEntryHeading from './JournalEntryHeading';
import JournalEditorForm from './JournalEditorForm';
import { EditorMessages, FeedbackStatus } from './JournalEditorMessages';
import type { JournalAnalysis, JournalEntry } from './types';

interface JournalEditorProps {
  ownerId: string;
  entryId: string;
  onSaved: (entry: JournalEntry) => void;
  onOpen: (id: string) => void;
  nested?: boolean;
  initial?: { entry: JournalEntry; analysis: JournalAnalysis | null };
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

function useEditorFeedback({ ownerId, entryId, onSaved, initial }: JournalEditorProps) {
  const editor = useJournalEditor({ ownerId, entryId, onSaved, initialEntry: initial?.entry });
  const analysis = useJournalAnalysis({
    ownerId,
    entryId,
    submitted: editor.submitted,
    submission: editor.submission,
    initial: initial ? { data: initial.analysis, entry: initial.entry } : undefined,
    enabled: Boolean(editor.draft?.expectedVersion),
    onEntry: editor.acceptGeneratedEntry,
  });
  const current = currentFeedback(editor, analysis);
  const processing = isProcessing(current);
  return { editor, analysis, current, processing };
}

const JournalEditor = ({
  ownerId,
  entryId,
  onSaved,
  onOpen,
  renderFeedback,
  nested = false,
  initial,
}: JournalEditorProps) => {
  const [editing, setEditing] = useState(false);
  const { editor, analysis, current, processing } = useEditorFeedback({
    ownerId,
    entryId,
    onSaved,
    onOpen,
    initial,
  });
  const reviewing = current?.status === 'ready' && !editing;

  return (
    <article className={nested ? 'space-y-6' : 'mx-auto w-full max-w-3xl space-y-6 p-5 sm:p-8'}>
      <EditorMessages editor={editor} onOpen={onOpen} />
      {reviewing ? (
        <JournalEntryHeading draft={editor.draft} nested={nested} onEdit={() => setEditing(true)} />
      ) : (
        <JournalEditorForm
          editor={editor}
          processing={processing}
          onSubmitted={() => setEditing(false)}
        />
      )}

      <FeedbackStatus
        analysis={analysis}
        current={current}
        retry={() => {
          analysis.refetch().catch(() => undefined);
        }}
      />
      {reviewing && current && renderFeedback?.(current)}
    </article>
  );
};

export default JournalEditor;
