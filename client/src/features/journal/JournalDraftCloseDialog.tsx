import { useId } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import JournalAvatar from './JournalAvatar';
import { getTutorPreferences, tutorAvatar } from './journalTutor';
import useJournalModal from './useJournalModal';
import useJournalDraftClose from './useJournalDraftClose';
import type useJournalEditor from './useJournalEditor';
import './journalEntryDialogs.css';
import './journalDraftActions.css';

interface Props {
  ownerId: string;
  editor: ReturnType<typeof useJournalEditor>;
  onDismiss: () => void;
  onClose: () => void;
}

const DraftTutor = ({ ownerId }: { ownerId: string }) => {
  const preferences = useQuery({
    queryKey: ['journal-tutor', ownerId],
    queryFn: getTutorPreferences,
    staleTime: Infinity,
  });
  const data = preferences.data?.data;
  const tutor = data?.tutors.find((item) => item.id === data.selectedId) ?? data?.tutors[0];
  return <JournalAvatar src={tutor && tutorAvatar(tutor)} className="journal-draft-tutor" />;
};

const JournalDraftCloseDialog = ({ ownerId, editor, onDismiss, onClose }: Props) => {
  const dialog = useJournalModal();
  const labelId = useId();
  const descriptionId = useId();
  const { action, error, pending, finish } = useJournalDraftClose(ownerId, editor, onClose);
  const busy = Boolean(action);
  const message = error || editor.error;
  return createPortal(
    <dialog
      ref={dialog}
      className="journal-entry-dialog journal-draft-close"
      aria-labelledby={labelId}
      aria-describedby={descriptionId}
      aria-busy={busy}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending.current) onDismiss();
      }}
    >
      <button
        type="button"
        className="journal-draft-dismiss"
        aria-label="Continue writing"
        disabled={busy}
        onClick={onDismiss}
      >
        <X size={18} aria-hidden="true" />
      </button>
      <div className="journal-draft-close-heading">
        <DraftTutor ownerId={ownerId} />
        <h2 id={labelId} className="journal-entry-dialog-heading">
          Keep this draft?
        </h2>
      </div>
      <p id={descriptionId} className="journal-draft-close-copy">
        Your writing is saved automatically. You can come back and finish it later.
      </p>
      {message && (
        <p role="alert" className="journal-draft-close-error">
          {message}
        </p>
      )}
      <div className="journal-draft-close-actions">
        <button
          type="button"
          className="journal-draft-button journal-draft-button--delete"
          disabled={busy}
          onClick={() => {
            finish('delete').catch(() => undefined);
          }}
        >
          {action === 'delete' ? 'Deleting…' : 'Delete draft'}
        </button>
        <button
          type="button"
          className="journal-draft-button journal-draft-button--sage"
          disabled={busy}
          onClick={() => {
            finish('keep').catch(() => undefined);
          }}
        >
          {action === 'keep' ? 'Saving…' : 'Keep draft & close'}
        </button>
      </div>
    </dialog>,
    document.body
  );
};

export default JournalDraftCloseDialog;
