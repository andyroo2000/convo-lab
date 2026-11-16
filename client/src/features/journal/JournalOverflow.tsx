import { useEffect, useRef, type ReactNode } from 'react';
import { Ellipsis } from 'lucide-react';

const JournalOverflow = ({ children }: { children: ReactNode }) => {
  const root = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element) return undefined;
    const outside = (event: PointerEvent) => {
      if (!element.contains(event.target as Node)) element.removeAttribute('open');
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !element.open) return;
      element.removeAttribute('open');
      element.querySelector('summary')?.focus();
    };
    const blur = (event: FocusEvent) => {
      if (event.relatedTarget && !element.contains(event.relatedTarget as Node)) {
        element.removeAttribute('open');
      }
    };
    element.addEventListener('focusout', blur);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      element.removeEventListener('focusout', blur);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, []);
  return (
    <details ref={root} className="journal-overflow">
      <summary aria-label="More journal options">
        <Ellipsis size={22} />
      </summary>
      <div className="journal-overflow-content">{children}</div>
    </details>
  );
};
export default JournalOverflow;
