import { useRef } from 'react';
import useJournalPopover from './useJournalPopover';

export default function useJournalActionPopover() {
  const popover = useJournalPopover();
  const closeOnClick = useRef(false);
  const restoringFocus = useRef(false);
  const { anchor, popup, open, close, show } = popover;
  const dismiss = () => {
    close();
    restoringFocus.current = document.activeElement !== anchor.current;
    anchor.current?.focus();
  };
  const trigger = {
    onFocus: () => {
      if (!restoringFocus.current) show();
      restoringFocus.current = false;
    },
    onPointerDown: () => {
      closeOnClick.current = open;
    },
    onClick: () => {
      if (closeOnClick.current) close();
      else {
        show();
        requestAnimationFrame(() => popup.current?.querySelector('button')?.focus());
      }
      closeOnClick.current = false;
    },
  };
  return { ...popover, dismiss, trigger };
}
