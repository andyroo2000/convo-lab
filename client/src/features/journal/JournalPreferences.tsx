import { useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { UserRound, X } from 'lucide-react';
import useDialogDismissal from '../../hooks/useDialogDismissal';
import JournalTutorPicker from './JournalTutorPicker';

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
  useDialogDismissal(dialog);
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
        onClick={() => {
          setChoosing(true);
          dialog.current?.showModal();
        }}
      >
        <UserRound size={18} aria-hidden="true" />
        Choose your tutor
      </button>
      {createPortal(
        <dialog
          ref={dialog}
          className="journal-voice-dialog"
          aria-label="Choose your tutor"
          onClose={() => setChoosing(false)}
        >
          <button
            type="button"
            aria-label="Close tutor picker"
            className="ml-auto flex h-11 w-11 items-center justify-center"
            onClick={close}
          >
            <X size={20} />
          </button>
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
