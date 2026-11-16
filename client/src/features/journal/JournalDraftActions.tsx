import { useState } from 'react';
import JournalDraftCloseDialog from './JournalDraftCloseDialog';
import type useJournalEditor from './useJournalEditor';
import './journalDraftActions.css';

type Editor = ReturnType<typeof useJournalEditor>;

const JournalDraftActions = ({
  editor,
  ownerId,
  processing,
  canSubmit,
  onClose = () => undefined,
  onSubmitted = () => undefined,
}: {
  editor: Editor;
  ownerId: string;
  processing: boolean;
  canSubmit: boolean;
  onClose?: () => void;
  onSubmitted?: () => void;
}) => {
  const [closing, setClosing] = useState(false);
  const { busy } = editor;
  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          className="journal-draft-button"
          disabled={busy || processing}
          onClick={() => setClosing(true)}
        >
          Close
        </button>
        <button
          type="button"
          className="journal-draft-button journal-draft-button--sage"
          disabled={!canSubmit}
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
      {closing && (
        <JournalDraftCloseDialog
          ownerId={ownerId}
          editor={editor}
          onDismiss={() => setClosing(false)}
          onClose={() => {
            setClosing(false);
            onClose();
          }}
        />
      )}
    </>
  );
};
export default JournalDraftActions;
