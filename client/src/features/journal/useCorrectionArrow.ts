import { useLayoutEffect, useRef } from 'react';

export default function useCorrectionArrow() {
  const container = useRef<HTMLDivElement>(null);
  const original = useRef<HTMLSpanElement>(null);
  const target = useRef<HTMLSpanElement>(null);
  const arrow = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const update = () => {
      if (!original.current) return;
      if (!target.current) return;
      if (!arrow.current) return;
      const before = original.current.getBoundingClientRect();
      const after = target.current.getBoundingClientRect();
      arrow.current.style.visibility = before.bottom <= after.top ? 'hidden' : 'visible';
    };
    update();
    if (!container.current) return undefined;
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(update);
    [container.current, original.current, target.current].forEach((element) => {
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  });
  return { container, original, target, arrow };
}
