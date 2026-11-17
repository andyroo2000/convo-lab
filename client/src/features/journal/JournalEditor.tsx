import { useEffect, type ReactNode } from 'react';
import TutorNotFound from '../../components/common/TutorNotFound';
import useJournalEditor from './useJournalEditor';
import useJournalAnalysis from './useJournalAnalysis';
import JournalEntryHeading from './JournalEntryHeading';
import JournalEditorForm from './JournalEditorForm';
import JournalClarificationDialog from './JournalClarificationDialog';
import { EditorMessages, FeedbackStatus } from './JournalEditorMessages';
import type { JournalAnalysis, JournalDraft, JournalEntry } from './types';

interface JournalEditorProps {
  ownerId: string;
  entryId: string;
  onSaved: (entry: JournalEntry) => void;
  onOpen: (id: string) => void;
  onClose?: () => void;
  nested?: boolean;
  onBusyChange?: (busy: boolean) => void;
  onWritingChange?: (writing: boolean) => void;
  initialDraft?: JournalDraft;
  initial?: { entry: JournalEntry; analysis: JournalAnalysis | null };
  pendingHeader?: ReactNode;
  renderFeedback?: (analysis: JournalAnalysis, heading: ReactNode) => ReactNode;
}

type Editor = ReturnType<typeof useJournalEditor>;

function entryPresentation(nested: boolean) {
  return nested
    ? { 'aria-label': 'Your reply', className: 'journal-reply space-y-6' }
    : {
        'aria-label': 'Journal entry',
        className: 'mx-auto w-full max-w-3xl space-y-6 p-5 sm:p-8',
      };
}

function currentFeedback(editor: Editor, analysis: ReturnType<typeof useJournalAnalysis>) {
  if (analysis.data?.entry.body !== editor.draft?.body) return null;
  return analysis.data?.data;
}

function isMissingEntry(editor: Editor) {
  return editor.notFound && !editor.draft;
}

function isProcessing(analysis: JournalAnalysis | null | undefined) {
  return analysis?.status === 'queued' || analysis?.status === 'processing';
}

function useEditorFeedback({
  ownerId,
  entryId,
  onSaved,
  initial,
  initialDraft,
}: JournalEditorProps) {
  const editor = useJournalEditor({
    ownerId,
    entryId,
    onSaved,
    initialEntry: initial?.entry,
    initialDraft,
  });
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
  const waiting = editor.clarification.active || editor.requestingFeedback || processing;
  const retryFeedback = () => {
    analysis.refetch().catch(() => undefined);
  };
  return { editor, analysis, current, processing, waiting, retryFeedback };
}

function useEditorBusy(
  editor: Editor,
  processing: boolean,
  notify: JournalEditorProps['onBusyChange']
) {
  const busy = editor.busy || processing || Boolean(editor.error && !editor.locallySaved);
  useEffect(() => {
    notify?.(busy);
    return () => notify?.(false);
  }, [busy, notify]);
}

function useEditorWriting(editor: Editor, notify: JournalEditorProps['onWritingChange']) {
  const body = editor.draft?.body;
  useEffect(() => {
    notify?.(Boolean(body?.trim()));
  }, [body, notify]);
}

const JournalEditor = ({
  ownerId,
  entryId,
  onSaved,
  onOpen,
  onClose,
  renderFeedback,
  onBusyChange,
  onWritingChange,
  nested = false,
  initial,
  pendingHeader,
  initialDraft,
}: JournalEditorProps) => {
  const { editor, analysis, current, processing, waiting, retryFeedback } = useEditorFeedback({
    ownerId,
    entryId,
    onSaved,
    onOpen,
    initial,
    initialDraft,
  });
  const reviewing = current?.status === 'ready';
  useEditorBusy(editor, processing, onBusyChange);
  useEditorWriting(editor, onWritingChange);

  if (isMissingEntry(editor))
    return (
      <article {...entryPresentation(nested)}>
        <TutorNotFound />
      </article>
    );

  if (waiting)
    return (
      <article {...entryPresentation(nested)}>
        <JournalClarificationDialog
          ownerId={ownerId}
          workflow={editor.clarification}
          waitingForFeedback
        />
        <FeedbackStatus analysis={analysis} current={current} retry={retryFeedback} />
      </article>
    );

  return (
    <article {...entryPresentation(nested)}>
      <EditorMessages editor={editor} onOpen={onOpen} />
      {!reviewing && (
        <>
          {pendingHeader}
          <JournalEditorForm
            ownerId={ownerId}
            editor={editor}
            processing={processing}
            onClose={onClose}
          />
        </>
      )}

      <FeedbackStatus analysis={analysis} current={current} retry={retryFeedback} />
      {reviewing &&
        current &&
        renderFeedback?.(current, nested ? null : <JournalEntryHeading draft={editor.draft} />)}
    </article>
  );
};

export default JournalEditor;
