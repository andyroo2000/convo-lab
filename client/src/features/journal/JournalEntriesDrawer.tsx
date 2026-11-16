import { useEffect, useRef, type ReactNode } from 'react';
import { BookOpen, X } from 'lucide-react';
import useDialogDismissal from '../../hooks/useDialogDismissal';

const JournalEntriesDrawer = ({ children, entryId }: { children: ReactNode; entryId?: string }) => {
  const dialog = useRef<HTMLDialogElement>(null);
  useDialogDismissal(dialog);
  useEffect(() => {
    dialog.current?.close();
  }, [entryId]);
  useEffect(() => {
    const element = dialog.current;
    const select = (event: MouseEvent) => {
      if ((event.target as HTMLElement).closest('a')) element?.close();
    };
    element?.addEventListener('click', select);
    return () => element?.removeEventListener('click', select);
  }, []);
  return (
    <>
      <button
        className="journal-entries-trigger"
        type="button"
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
      >
        <BookOpen size={18} /> My entries
      </button>
      <dialog ref={dialog} aria-label="My entries" className="journal-entries-drawer">
        <button
          type="button"
          className="journal-drawer-close"
          aria-label="Close entries"
          onClick={() => dialog.current?.close()}
        >
          <X size={20} />
        </button>
        {children}
      </dialog>
    </>
  );
};
export default JournalEntriesDrawer;
