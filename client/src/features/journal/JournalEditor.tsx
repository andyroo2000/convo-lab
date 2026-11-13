import { type ReactNode } from 'react';
import useJournalEditor from './useJournalEditor';
import useJournalAnalysis from './useJournalAnalysis';
import JournalEntryHeading from './JournalEntryHeading';
import JournalDeleteAction from './JournalDeleteAction';
import type useJournalArchive from './useJournalArchive';
import JournalEditorForm from './JournalEditorForm';
import { EditorMessages, FeedbackStatus } from './JournalEditorMessages';
import type { JournalAnalysis, JournalEntry } from './types';

interface JournalEditorProps {
  ownerId: string;
  entryId: string;
  onSaved: (entry: JournalEntry) => void;
  onOpen: (id: string) => void;
  nested?: boolean;
  remove?: ReturnType<typeof useJournalArchive>['remove'];
  onDeleted?: (id: string) => void;
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

function entryDeleteAction(
  editor: Editor,
  processing: boolean,
  remove: JournalEditorProps['remove'],
  onDeleted: JournalEditorProps['onDeleted']
) {
  return (
    editor.draft &&
    remove &&
    onDeleted && (
      <JournalDeleteAction
        draft={editor.draft}
        disabled={editor.busy || processing}
        remove={remove}
        onDeleted={onDeleted}
      />
    )
  );
}

const JournalEditor = ({
  ownerId,
  entryId,
  onSaved,
  onOpen,
  renderFeedback,
  remove,
  onDeleted,
  nested = false,
  initial,
}: JournalEditorProps) => {
  const { editor, analysis, current, processing } = useEditorFeedback({
    ownerId,
    entryId,
    onSaved,
    onOpen,
    initial,
  });
  const reviewing = current?.status === 'ready';
  const deleteAction = entryDeleteAction(editor, processing, remove, onDeleted);

  return (
    <article className={nested ? 'space-y-6' : 'mx-auto w-full max-w-3xl space-y-6 p-5 sm:p-8'}>
      <EditorMessages editor={editor} onOpen={onOpen} />
      {reviewing ? (
        <JournalEntryHeading draft={editor.draft} nested={nested} />
      ) : (
        <JournalEditorForm editor={editor} processing={processing} deleteAction={deleteAction} />
      )}

      <FeedbackStatus
        analysis={analysis}
        current={current}
        retry={() => {
          analysis.refetch().catch(() => undefined);
        }}
      />
      {reviewing && current && renderFeedback?.(current)}
      {reviewing && deleteAction}
    </article>
  );
};

export default JournalEditor;
