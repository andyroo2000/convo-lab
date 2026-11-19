import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import './journalCopyFeedback.css';

import JournalCopyFeedbackContext from './JournalCopyFeedbackContext';

const JournalCopyFeedback = ({ children }: { children: ReactNode }) => {
  const [notice, setNotice] = useState(0);
  const copied = useCallback(() => setNotice((value) => value + 1), []);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(0), 2000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  return (
    <JournalCopyFeedbackContext.Provider value={copied}>
      <div className="journal-copy-feedback">
        {children}
        <span role="status" aria-live="polite" aria-atomic="true">
          {notice > 0 && (
            <span className="journal-copy-toast">
              <Check size={16} aria-hidden="true" /> Text copied
            </span>
          )}
        </span>
      </div>
    </JournalCopyFeedbackContext.Provider>
  );
};

export default JournalCopyFeedback;
