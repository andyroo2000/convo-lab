import { useEffect, type RefObject } from 'react';
import useDialogDismissal from '../../hooks/useDialogDismissal';

function show(dialog: HTMLDialogElement) {
  if (dialog.open) return;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}
function close(dialog: HTMLDialogElement | null) {
  if (dialog?.open && typeof dialog.close === 'function') dialog.close();
  else dialog?.removeAttribute('open');
}
export default function usePreviewDialog(
  dialogRef: RefObject<HTMLDialogElement | null>,
  closeButtonRef: RefObject<HTMLButtonElement | null>,
  toggleSide: () => void
) {
  useDialogDismissal(dialogRef);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog) {
      show(dialog);
      closeButtonRef.current?.focus();
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      event.preventDefault();
      toggleSide();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      close(dialog);
    };
  }, [dialogRef, closeButtonRef, toggleSide]);
}
