import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { journalTextStyle } from './journalTypography';
import type useJournalEditor from './useJournalEditor';

type Editor = ReturnType<typeof useJournalEditor>;

function saveStatus(editor: Editor): string {
  if (editor.busy) return 'Saving…';
  if (editor.error) return 'Check save status';
  if (editor.locallySaved) return 'Draft saved on this device';
  return 'Draft saved';
}

const DraftSaveStatus = ({ editor }: { editor: Editor }) => (
  <span
    role="status"
    className="flex w-full items-center justify-end gap-1.5 text-xs text-gray-500 sm:w-auto"
  >
    {!editor.busy && !editor.error && <Check className="h-4 w-4" aria-hidden="true" />}
    {saveStatus(editor)}
  </span>
);

const JournalEditorForm = ({
  editor,
  processing,
  deleteAction,
  onSubmitted = () => undefined,
}: {
  editor: Editor;
  processing: boolean;
  deleteAction?: ReactNode;
  onSubmitted?: () => void;
}) => {
  const { draft, busy } = editor;
  if (!draft) return null;
  return (
    <>
      <label htmlFor="journal-title" className="block">
        <span className="sr-only">Title (optional)</span>
        <input
          id="journal-title"
          className="w-full border-0 bg-transparent text-3xl font-semibold text-navy outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-indigo/30"
          placeholder="Untitled entry"
          value={draft.title ?? ''}
          maxLength={255}
          disabled={busy}
          onChange={(event) => editor.change({ title: event.target.value || null })}
        />
      </label>
      <label htmlFor="journal-body" className="block">
        <span className="sr-only">Journal entry in Japanese</span>
        <textarea
          style={journalTextStyle}
          id="journal-body"
          lang="ja"
          className="min-h-64 w-full resize-y rounded-2xl border border-gray-200 bg-white p-5 text-xl leading-loose text-navy focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/20"
          placeholder="今日は…"
          value={draft.body}
          maxLength={20000}
          disabled={busy}
          onChange={(event) => editor.change({ body: event.target.value })}
        />
      </label>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="mr-auto">{deleteAction}</div>
        <DraftSaveStatus editor={editor} />
        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={() => {
            editor.save().catch(() => undefined);
          }}
        >
          Save draft
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={busy || processing || !draft.body.trim()}
          onClick={() => {
            editor
              .save(true)
              .then((success) => {
                if (success) onSubmitted();
              })
              .catch(() => undefined);
          }}
        >
          {busy ? 'Saving…' : 'Submit'}
        </button>
      </div>
    </>
  );
};

export default JournalEditorForm;
