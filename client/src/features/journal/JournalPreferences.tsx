import { useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { UserRound } from 'lucide-react';
import useDialogDismissal from '../../hooks/useDialogDismissal';
import JournalTutorPicker from './JournalTutorPicker';
import './journalEntryDialogs.css';
import './journalChoicePicker.css';

const JournalPreferences = ({
  ownerId,
  appearance,
}: {
  ownerId: string;
  appearance: ReactNode;
}) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const [choosing, setChoosing] = useState(false);
  const client = useQueryClient();
  const openDialog = useDialogDismissal(dialog);
  const close = () => {
    dialog.current?.close();
    setChoosing(false);
  };
  return (
    <section aria-label="Journal settings" className="journal-account-preferences">
      <h2>Journal</h2>
      {appearance}
      <button
        type="button"
        className="journal-menu-item"
        aria-haspopup="dialog"
        onClick={(event) => {
          setChoosing(true);
          openDialog(event.currentTarget);
        }}
      >
        <UserRound size={18} aria-hidden="true" />
        Choose your tutor
      </button>
      {createPortal(
        <dialog
          ref={dialog}
          className="journal-entry-dialog journal-choice-dialog"
          aria-label="Choose your tutor"
          onClose={() => setChoosing(false)}
        >
          {choosing && (
            <JournalTutorPicker
              ownerId={ownerId}
              onClose={close}
              onSelected={() => {
                close();
                client
                  .invalidateQueries({ queryKey: ['journal-question', ownerId] })
                  .catch(() => undefined);
              }}
            />
          )}
        </dialog>,
        document.body
      )}
    </section>
  );
};
export default JournalPreferences;
