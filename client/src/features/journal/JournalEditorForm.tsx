import JournalDraftActions from './JournalDraftActions';
import JournalWritingField from './JournalWritingField';
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
      {draft.title && <h1 className="text-3xl font-semibold text-navy">{draft.title}</h1>}
      <JournalWritingField
        style={journalTextStyle}
        id="journal-body"
        lang="ja"
        aria-label="Journal entry in Japanese"
        className="min-h-64 w-full rounded-2xl border border-gray-200 bg-white p-5 text-xl leading-loose text-navy focus-within:border-indigo focus-within:ring-2 focus-within:ring-indigo/20"
        placeholder="今日は…"
        value={draft.body}
        maxLength={20000}
        disabled={busy}
        onChange={(event) => editor.change({ body: event.target.value })}
      />
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
