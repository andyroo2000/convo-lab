import { useMemo, useState, type ReactNode } from 'react';
import JournalNavigationContext from './JournalNavigationContext';

const JournalNavigationProvider = ({ children }: { children: ReactNode }) => {
  const [contents, setContents] = useState<HTMLDivElement | null>(null);
  const [settings, setSettings] = useState<HTMLDivElement | null>(null);
  const value = useMemo(
    () => ({ contents, settings, setContents, setSettings }),
    [contents, settings]
  );
  return (
    <JournalNavigationContext.Provider value={value}>{children}</JournalNavigationContext.Provider>
  );
};

export default JournalNavigationProvider;
