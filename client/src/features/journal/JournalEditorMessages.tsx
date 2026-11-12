import type useJournalEditor from './useJournalEditor';
import type useJournalAnalysis from './useJournalAnalysis';
import type { JournalAnalysis } from './types';
import JournalProgress from './JournalProgress';

type Editor = ReturnType<typeof useJournalEditor>;

export const EditorMessages = ({
  editor,
  onOpen,
}: {
  editor: Editor;
  onOpen: (id: string) => void;
}) => (
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

export const FeedbackStatus = ({
  analysis,
  retry,
  current,
}: {
  current: JournalAnalysis | null | undefined;
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
  if (current?.status === 'failed')
    return (
      <p role="alert" className="text-sm text-rose-700">
        {current.error} Submit again to retry.
      </p>
    );
  if (current?.status === 'queued' || current?.status === 'processing')
    return (
      <JournalProgress key={current.id} status={current.status} startedAt={current.updatedAt} />
    );
  return null;
};
