import JournalDraftActions from './JournalDraftActions';
import { journalTextStyle } from './journalTypography';
import type useJournalEditor from './useJournalEditor';

type Editor = ReturnType<typeof useJournalEditor>;

const JournalEditorForm = ({
  editor,
  ownerId,
  onClose,
  processing,
  onSubmitted = () => undefined,
}: {
  editor: Editor;
  ownerId: string;
  onClose?: () => void;
  processing: boolean;
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
      <JournalDraftActions
        editor={editor}
        ownerId={ownerId}
        processing={processing}
        canSubmit={!busy && !processing && Boolean(draft.body.trim())}
        onClose={onClose}
        onSubmitted={onSubmitted}
      />
    </>
  );
};

export default JournalEditorForm;
