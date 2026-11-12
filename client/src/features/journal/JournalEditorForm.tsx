import type useJournalEditor from './useJournalEditor';

type Editor = ReturnType<typeof useJournalEditor>;

function saveStatus(editor: Editor): string {
  if (editor.locallySaved) return 'Draft saved on this device';
  return editor.error ? 'Check save status' : 'Saved';
}

const JournalEditorForm = ({ editor, processing }: { editor: Editor; processing: boolean }) => {
  const { draft, busy } = editor;
  if (!draft) return null;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label htmlFor="journal-date" className="text-sm text-gray-600">
          Date
          <input
            id="journal-date"
            aria-label="Entry date"
            type="date"
            className="ml-2 rounded-lg border border-gray-200 p-2"
            value={draft.entryDate}
            disabled={busy}
            onChange={(event) => editor.change({ entryDate: event.target.value })}
          />
        </label>
        <span className="text-xs text-gray-500">{saveStatus(editor)}</span>
      </div>
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
      <div className="flex justify-end gap-3">
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
            editor.save(true).catch(() => undefined);
          }}
        >
          {busy ? 'Saving…' : 'Submit'}
        </button>
      </div>
    </>
  );
};

export default JournalEditorForm;
