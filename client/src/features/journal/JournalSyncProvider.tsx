import { useEffect, useMemo, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import JournalDraftOutbox from './journalDraftOutbox';
import JournalSyncContext from './JournalSyncContext';

const JournalSyncProvider = ({ ownerId, children }: { ownerId: string; children: ReactNode }) => {
  const client = useQueryClient();
  const outbox = useMemo(() => new JournalDraftOutbox(ownerId), [ownerId]);
  useEffect(() => {
    outbox.resume();
    const sync = () => {
      outbox.synchronize().catch(() => undefined);
    };
    const reconnect = () => {
      outbox.reconnect();
      sync();
    };
    const seen = new Map<string, number>();
    const unsubscribe = outbox.subscribe(() => {
      outbox.receipts.forEach(({ entry }) => {
        if (seen.get(entry.id) === entry.version) return;
        seen.set(entry.id, entry.version);
        client.invalidateQueries({ queryKey: ['journal-archive', ownerId] }).catch(() => undefined);
      });
    });
    const timer = window.setInterval(sync, 3000);
    window.addEventListener('online', reconnect);
    window.addEventListener('focus', sync);
    sync();
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('online', reconnect);
      window.removeEventListener('focus', sync);
      unsubscribe();
      outbox.stop();
    };
  }, [client, outbox, ownerId]);
  return <JournalSyncContext.Provider value={outbox}>{children}</JournalSyncContext.Provider>;
};

export default JournalSyncProvider;
