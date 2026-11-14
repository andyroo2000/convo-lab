import { useEffect, useRef } from 'react';
import useDialogDismissal from '../../hooks/useDialogDismissal';

export default function useJournalModal() {
  const dialog = useRef<HTMLDialogElement>(null);
  useDialogDismissal(dialog);
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement;
    const { overflow } = document.body.style;
    element?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

  return dialog;
}
