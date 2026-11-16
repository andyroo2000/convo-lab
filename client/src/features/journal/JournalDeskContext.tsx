import { createContext } from 'react';
import type { ReactNode } from 'react';

const JournalDeskContext = createContext<{
  target: HTMLElement | null;
  appearance?: ReactNode;
}>({ target: null });

export default JournalDeskContext;
