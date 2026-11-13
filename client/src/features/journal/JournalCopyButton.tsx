import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';

const JournalCopyButton = ({
  text,
  label: copyLabel = 'Copy corrected version',
}: {
  text: string;
  label?: string;
}) => {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setError(false);
    } catch {
      setError(true);
    }
  }
  const label = copied ? 'Copied' : copyLabel;
  const Icon = copied ? Check : Copy;
  return (
    <div className="relative">
      <button
        type="button"
        aria-label={label}
        title={label}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-indigo hover:bg-indigo/5"
        onClick={() => {
          copy().catch(() => undefined);
        }}
      >
        <Icon size={18} aria-hidden="true" />
      </button>
      <span role="status" className="sr-only">
        {copied ? 'Copied' : ''}
      </span>
      {error && (
        <p
          role="alert"
          className="absolute right-0 top-full z-10 w-64 rounded-lg border border-rose-100 bg-white p-3 text-sm text-rose-700 shadow-sm"
        >
          Could not copy. Select the text to copy it.
        </p>
      )}
    </div>
  );
};

export default JournalCopyButton;
