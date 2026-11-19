import { createContext } from 'react';

const JournalNavigationContext = createContext<{
  contents: HTMLElement | null;
  settings: HTMLElement | null;
  setContents: (element: HTMLDivElement | null) => void;
  setSettings: (element: HTMLDivElement | null) => void;
}>({ contents: null, settings: null, setContents: () => undefined, setSettings: () => undefined });

export default JournalNavigationContext;
