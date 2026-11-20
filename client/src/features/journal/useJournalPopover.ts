import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import journalPopoverPosition from './journalPopoverPosition';

function positionPopover(anchor: HTMLElement | null, popup: HTMLElement | null, gap: number) {
  if (!anchor || !popup) return null;
  return journalPopoverPosition(
    anchor.getBoundingClientRect(),
    popup.getBoundingClientRect(),
    { width: window.innerWidth, height: window.innerHeight },
    gap
  );
}

function dismissPopover(
  { anchor, popup }: { anchor: RefObject<HTMLElement>; popup: RefObject<HTMLElement> },
  close: () => void
) {
  const outside = (event: Event) => {
    if (anchor.current?.contains(event.target as Node)) return;
    if (!popup.current?.contains(event.target as Node)) close();
  };
  const escape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') close();
  };
  document.addEventListener('pointerdown', outside);
  document.addEventListener('focusin', outside);
  document.addEventListener('keydown', escape);
  const scroll = (event: Event) => {
    if (!popup.current?.contains(event.target as Node)) close();
  };
  window.addEventListener('scroll', scroll, true);
  return () => {
    document.removeEventListener('pointerdown', outside);
    document.removeEventListener('focusin', outside);
    document.removeEventListener('keydown', escape);
    window.removeEventListener('scroll', scroll, true);
  };
}

export default function useJournalPopover(gap = 6) {
  const anchor = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const timeout = useRef<ReturnType<typeof setTimeout>>();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({
    left: 12,
    top: 12,
    pointerLeft: 24,
    placement: 'below',
    pointerVisible: false,
  });
  const show = () => {
    clearTimeout(timeout.current);
    setOpen(true);
  };
  const hide = () => {
    timeout.current = setTimeout(() => setOpen(false), 120);
  };

  useEffect(() => () => clearTimeout(timeout.current), []);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const reposition = () => {
      const placement = positionPopover(anchor.current, popup.current, gap);
      if (placement) setPosition(placement);
    };
    reposition();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(reposition);
    if (popup.current) observer?.observe(popup.current);
    window.addEventListener('resize', reposition);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', reposition);
    };
  }, [open, gap]);

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    const detach = dismissPopover({ anchor, popup }, close);
    return () => {
      clearTimeout(timeout.current);
      detach();
    };
  }, [open]);

  const close = () => {
    clearTimeout(timeout.current);
    setOpen(false);
  };
  return {
    anchor,
    popup,
    open,
    position: { left: position.left, top: position.top },
    pointer: {
      left: position.pointerLeft,
      placement: position.placement,
      visible: position.pointerVisible,
    },
    show,
    hide,
    close,
  };
}
