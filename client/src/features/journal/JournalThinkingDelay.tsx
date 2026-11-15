import { useEffect, useState } from 'react';

const JournalThinkingDelay = () => {
  const [delayed, setDelayed] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setDelayed(true), 60000);
    return () => window.clearTimeout(timer);
  }, []);
  if (!delayed) return null;
  return (
    <div className="mt-6 max-w-sm text-sm text-slate-600">
      <p role="status">This is taking longer than usual. Your writing is saved.</p>
      <a
        href="/app/journal"
        className="mt-2 inline-flex min-h-11 items-center text-indigo underline"
      >
        Return to journal
      </a>
    </div>
  );
};
export default JournalThinkingDelay;
