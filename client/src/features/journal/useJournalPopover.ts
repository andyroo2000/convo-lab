import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

function positionPopover(anchor: HTMLElement | null, popup: HTMLElement | null) {
  if (!anchor || !popup) return null;
  const rect = anchor.getBoundingClientRect();
  const size = popup.getBoundingClientRect();
  const left = Math.max(12, Math.min(rect.left, window.innerWidth - size.width - 12));
  const top =
    rect.bottom + size.height + 12 < window.innerHeight
      ? rect.bottom + 6
      : Math.max(12, rect.top - size.height - 6);
  return { left, top };
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
  window.addEventListener('resize', close);
  const scroll = (event: Event) => {
    if (!popup.current?.contains(event.target as Node)) close();
  };
  window.addEventListener('scroll', scroll, true);
  return () => {
    document.removeEventListener('pointerdown', outside);
    document.removeEventListener('focusin', outside);
    document.removeEventListener('keydown', escape);
    window.removeEventListener('resize', close);
    window.removeEventListener('scroll', scroll, true);
  };
}

export default function useJournalPopover() {
  const anchor = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const timeout = useRef<ReturnType<typeof setTimeout>>();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 12, top: 12 });
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
      const placement = positionPopover(anchor.current, popup.current);
      if (placement) setPosition(placement);
    };
    reposition();
    if (!popup.current || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(reposition);
    observer.observe(popup.current);
    return () => observer.disconnect();
  }, [open]);

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
  return { anchor, popup, open, position, show, hide, close };
}
