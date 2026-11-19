import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { List, X } from 'lucide-react';
import useDialogDismissal from '../../hooks/useDialogDismissal';

function useCloseOnEntryClick(dialog: RefObject<HTMLDialogElement>) {
  useEffect(() => {
    const element = dialog.current;
    const select = (event: MouseEvent) => {
      if (event.metaKey || event.ctrlKey) return;
      if ((event.target as HTMLElement).closest('a')) element?.close();
    };
    element?.addEventListener('click', select);
    return () => element?.removeEventListener('click', select);
  }, [dialog]);
}

const JournalEntriesDrawer = ({
  children,
  entryId,
  disabled = false,
  onOpen,
}: {
  children: ReactNode;
  entryId?: string;
  disabled?: boolean;
  onOpen?: () => void;
}) => {
  const dialog = useRef<HTMLDialogElement>(null);
  useDialogDismissal(dialog);
  useEffect(() => {
    dialog.current?.close();
  }, [entryId]);
  useCloseOnEntryClick(dialog);
  return (
    <>
      <button
        className="journal-entries-trigger"
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        onClick={() => {
          onOpen?.();
          dialog.current?.showModal();
        }}
      >
        <List size={18} aria-hidden="true" />
        <span>Contents</span>
      </button>
      <dialog ref={dialog} aria-label="Contents" className="journal-entries-drawer">
        <button
          type="button"
          className="journal-drawer-close"
          aria-label="Close entries"
          onClick={() => dialog.current?.close()}
        >
          <X size={20} aria-hidden="true" />
        </button>
        {children}
      </dialog>
    </>
  );
};
export default JournalEntriesDrawer;
