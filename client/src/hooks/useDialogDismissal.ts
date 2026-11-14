import { useEffect, type RefObject } from 'react';

function isBackdrop(event: MouseEvent, dialog: HTMLDialogElement) {
  if (event.target !== dialog) return false;
  const rect = dialog.getBoundingClientRect();
  return (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  );
}

/** Route backdrop dismissal through cancel so pending-action guards still apply. */
export default function useDialogDismissal(ref: RefObject<HTMLDialogElement | null>) {
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return undefined;
    let startedOutside = false;
    const pointerDown = (event: PointerEvent) => {
      startedOutside = isBackdrop(event, dialog);
    };
    const click = (event: MouseEvent) => {
      const dismiss = startedOutside && isBackdrop(event, dialog);
      startedOutside = false;
      if (!dismiss) return;
      if (dialog.dispatchEvent(new Event('cancel', { cancelable: true }))) dialog.close();
    };
    dialog.addEventListener('pointerdown', pointerDown);
    dialog.addEventListener('click', click);
    return () => {
      dialog.removeEventListener('pointerdown', pointerDown);
      dialog.removeEventListener('click', click);
    };
  }, [ref]);
}
