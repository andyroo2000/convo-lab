import type { ReactNode } from 'react';
import useJournalEditor from './useJournalEditor';
import useJournalAnalysis from './useJournalAnalysis';
import JournalEditorForm from './JournalEditorForm';
import type { JournalAnalysis, JournalEntry } from './types';

interface JournalEditorProps {
  ownerId: string;
  entryId: string;
  onSaved: (entry: JournalEntry) => void;
  onOpen: (id: string) => void;
  renderFeedback?: (analysis: JournalAnalysis) => ReactNode;
}

type Editor = ReturnType<typeof useJournalEditor>;

const EditorMessages = ({ editor, onOpen }: { editor: Editor; onOpen: (id: string) => void }) => (
  <>
    {editor.error && (
      <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">
        {editor.error}
      </p>
    )}
    {editor.conflict && (
      <div className="space-y-2 text-sm">
        <p>This entry changed on another device. Your writing is still here.</p>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            const copy = editor.copyAsNew();
            if (copy) onOpen(copy.id);
          }}
        >
          Save my writing as a new entry
        </button>
      </div>
    )}
    {!editor.draft && !editor.error && <p role="status">Loading entry…</p>}
  </>
);

const FeedbackStatus = ({
  analysis,
  retry,
}: {
  analysis: ReturnType<typeof useJournalAnalysis>;
  retry: () => void;
}) => {
  if (analysis.error)
    return (
      <p role="alert" className="text-sm text-rose-700">
        Could not load feedback.{' '}
        <button type="button" className="underline" onClick={retry}>
          Retry
        </button>
      </p>
    );
  const current = analysis.data?.data;
  if (current?.status === 'failed')
    return (
      <p role="alert" className="text-sm text-rose-700">
        {current.error} Submit again to retry.
      </p>
    );
  if (current?.status === 'queued' || current?.status === 'processing')
    return (
      <p role="status" className="text-sm text-gray-600">
        Preparing feedback…
      </p>
    );
  return null;
};

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
        retry={() => {
          analysis.refetch().catch(() => undefined);
        }}
      />
      {current?.status === 'ready' && renderFeedback?.(current)}
    </article>
  );
};

export default JournalEditor;
