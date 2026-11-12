import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

const JournalCopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setError(false);
    } catch {
      setError(true);
    }
  }
  const label = copied ? 'Copied' : 'Copy corrected version';
  const Icon = copied ? Check : Copy;
  return (
    <div>
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
      {error && (
        <p role="alert" className="text-sm text-rose-700">
          Could not copy. Select the corrected text to copy it.
        </p>
      )}
    </div>
  );
};

export default JournalCopyButton;
