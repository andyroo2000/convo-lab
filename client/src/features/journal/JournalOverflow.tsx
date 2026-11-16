import { useEffect, useRef, type ReactNode } from 'react';
import { Ellipsis } from 'lucide-react';

const JournalOverflow = ({ children }: { children: ReactNode }) => {
  const root = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) root.current?.removeAttribute('open');
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !root.current?.open) return;
      root.current.removeAttribute('open');
      root.current.querySelector('summary')?.focus();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
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
