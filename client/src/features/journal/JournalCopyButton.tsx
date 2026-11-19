import { useContext, useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import JournalCopyFeedbackContext from './JournalCopyFeedbackContext';

function confirmCopy(button: HTMLButtonElement | null, feedback: (() => void) | null) {
  if (!feedback) return;
  feedback();
  const menu = button?.closest('details');
  menu?.removeAttribute('open');
  menu?.querySelector('summary')?.focus();
}

function copyAnnouncement(copied: boolean, hasFeedback: boolean) {
  return copied && !hasFeedback ? 'Copied' : '';
}

function copyMenuLabel(copied: boolean) {
  return copied ? 'Copied' : 'Copy text';
}

const CopyError = ({ error }: { error: boolean }) =>
  error ? (
    <p
      role="alert"
      className="absolute right-0 top-full z-10 w-64 rounded-lg border border-rose-100 bg-white p-3 text-sm text-rose-700 shadow-sm"
    >
      Could not copy. Select the text to copy it.
    </p>
  ) : null;

const JournalCopyButton = ({
  text,
  label: copyLabel = 'Copy corrected version',
  menu = false,
}: {
  text: string;
  label?: string;
  menu?: boolean;
}) => {
  const feedback = useContext(JournalCopyFeedbackContext);
  const button = useRef<HTMLButtonElement>(null);
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
      confirmCopy(button.current, feedback);
    } catch {
      setError(true);
    }
  }
  const label = copied ? 'Copied' : copyLabel;
  const Icon = copied ? Check : Copy;
  const menuLabel = copyMenuLabel(copied);
  return (
    <div className="relative">
      <button
        ref={button}
        type="button"
        aria-label={menu ? `${menuLabel} (${copyLabel})` : label}
        title={label}
        className={
          menu
            ? 'journal-menu-item'
            : 'flex h-10 w-10 items-center justify-center rounded-lg text-indigo hover:bg-indigo/5'
        }
        onClick={() => {
          copy().catch(() => undefined);
        }}
      >
        <Icon size={18} aria-hidden="true" />
        {menu && menuLabel}
      </button>
      <span role="status" className="sr-only">
        {copyAnnouncement(copied, Boolean(feedback))}
      </span>
      <CopyError error={error} />
    </div>
  );
};

export default JournalCopyButton;
