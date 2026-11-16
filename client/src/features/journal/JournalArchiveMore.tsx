import { useEffect, useRef } from 'react';

interface Props {
  busy: boolean;
  automatic: boolean;
  cursor?: string | null;
  load: () => void;
}
const JournalArchiveMore = ({ busy, automatic, cursor, load }: Props) => {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!automatic || busy) return undefined;
    if (!button.current) return undefined;
    if (!window.IntersectionObserver) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) load();
    });
    observer.observe(button.current);
    return () => observer.disconnect();
  }, [automatic, busy, cursor, load]);
  return (
    <button
      ref={button}
      type="button"
      className="btn-secondary w-full"
      disabled={busy}
      onClick={load}
    >
      Load more
    </button>
  );
};
export default JournalArchiveMore;
