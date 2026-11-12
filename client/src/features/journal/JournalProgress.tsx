import { useEffect, useState } from 'react';

const JournalProgress = ({
  status,
  startedAt,
}: {
  status: 'queued' | 'processing';
  startedAt?: string;
}) => {
  const [openedAt] = useState(Date.now);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const parsed = Date.parse(startedAt ?? '');
  const elapsed = Math.max(
    0,
    Math.floor((now - (Number.isFinite(parsed) ? parsed : openedAt)) / 1000)
  );
  const queued = status === 'queued';
  // This is an estimate of waiting time, not a percentage reported by the model.
  const width = queued ? 8 : Math.min(94, 15 + 79 * (1 - Math.exp(-elapsed / 35)));
  const message =
    elapsed >= 60
      ? 'Still working. Longer entries can take more time; your writing is saved.'
      : 'Allow about 30–60 seconds for feedback. Your writing is saved.';

  return (
    <section
      className="rounded-2xl border border-indigo/15 bg-indigo/5 p-5"
      aria-label="Feedback progress"
      aria-busy="true"
    >
      <div className="mb-3 flex items-center justify-between gap-4">
        <p role="status" className="font-medium text-navy">
          {queued ? 'Waiting to begin…' : 'Reviewing your Japanese…'}
        </p>
        <span aria-hidden="true" className="text-sm tabular-nums text-gray-500">
          {elapsed}s
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Preparing journal feedback"
        aria-valuetext={queued ? 'Queued' : 'Reviewing; time estimate only'}
        className="h-2.5 overflow-hidden rounded-full bg-indigo/10"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo via-violet-500 to-sky-400 transition-[width] duration-1000 motion-safe:animate-pulse motion-reduce:transition-none"
          style={{ width: `${width}%` }}
        />
      </div>
      <p className="mt-3 text-sm text-gray-600">{message}</p>
    </section>
  );
};

export default JournalProgress;
