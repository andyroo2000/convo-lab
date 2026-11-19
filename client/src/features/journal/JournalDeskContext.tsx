import { createContext } from 'react';
import type { ReactNode } from 'react';

const JournalDeskContext = createContext<{
  target: HTMLElement | null;
  appearance?: ReactNode;
  textSize?: number;
  editingChanged?: (delta: number) => void;
}>({ target: null });

export default JournalDeskContext;
