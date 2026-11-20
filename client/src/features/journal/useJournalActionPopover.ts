import { useEffect, useRef } from 'react';
import useJournalPopover from './useJournalPopover';

export default function useJournalActionPopover() {
  const popover = useJournalPopover(16);
  const activated = useRef(false);
  const { anchor, open, close, show, hide } = popover;

  useEffect(() => {
    if (!open) activated.current = false;
  }, [open]);

  const trigger = {
    onFocus: show,
    onClick: () => {
      if (activated.current && open) {
        activated.current = false;
        close();
      } else {
        activated.current = true;
        anchor.current?.focus({ preventScroll: true });
        show();
      }
    },
  };

  return {
    ...popover,
    trigger,
    hide: () => {
      if (!activated.current) hide();
    },
  };
}
