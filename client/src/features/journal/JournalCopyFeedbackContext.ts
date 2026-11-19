import { createContext } from 'react';

const JournalCopyFeedbackContext = createContext<(() => void) | null>(null);

export default JournalCopyFeedbackContext;
