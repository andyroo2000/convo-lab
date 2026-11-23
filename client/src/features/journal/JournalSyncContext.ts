import { createContext, useContext, useSyncExternalStore } from 'react';
import type JournalDraftOutbox from './journalDraftOutbox';

const JournalSyncContext = createContext<JournalDraftOutbox | null>(null);
const emptySubscribe = () => () => undefined;
const emptySnapshot = () => 0;
export function useJournalSync() {
  const outbox = useContext(JournalSyncContext);
  const revision = useSyncExternalStore(
    outbox?.subscribe ?? emptySubscribe,
    outbox?.snapshot ?? emptySnapshot
  );
  return { outbox, revision };
}
export default JournalSyncContext;
