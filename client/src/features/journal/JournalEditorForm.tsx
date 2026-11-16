import JournalDraftActions from './JournalDraftActions';
import JournalWritingField from './JournalWritingField';
import JournalPaper from './JournalPaper';
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
      <JournalPaper
        heading={
          draft.title ? (
            <header className="journal-paper-heading">
              <h1 className="journal-paper-title">{draft.title}</h1>
            </header>
          ) : undefined
        }
      >
        <JournalWritingField
          id="journal-body"
          lang="ja"
          aria-label="Journal entry in Japanese"
          className="journal-writing-field--paper"
          rows={4}
          placeholder="今日は…"
          value={draft.body}
          maxLength={20000}
          disabled={busy}
          onChange={(event) => editor.change({ body: event.target.value })}
        />
      </JournalPaper>
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
