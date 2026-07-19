import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';

import { useKnownKanji, useSyncWaniKani } from '../hooks/useKnownKanji';

const AUTO_SYNC_AFTER_MS = 15 * 60 * 1000;

interface KnownKanjiContextValue {
  active: boolean;
  knownKanji: ReadonlySet<string>;
}

const KnownKanjiContext = createContext<KnownKanjiContextValue>({
  active: false,
  knownKanji: new Set(),
});

export const KnownKanjiContextProvider = ({
  active,
  children,
  knownKanji,
}: KnownKanjiContextValue & { children: ReactNode }) => {
  const value = useMemo(() => ({ active, knownKanji }), [active, knownKanji]);

  return <KnownKanjiContext.Provider value={value}>{children}</KnownKanjiContext.Provider>;
};

export const KnownKanjiProvider = ({ children }: { children: ReactNode }) => {
  const query = useKnownKanji();
  const sync = useSyncWaniKani();
  const lastSyncedAt = query.data?.wanikani.lastSyncedAt ?? null;
  const connected = query.data?.wanikani.connected ?? false;
  const mutateSync = sync.mutate;

  useEffect(() => {
    if (!connected) return undefined;

    let disposed = false;
    let timeout: ReturnType<typeof setTimeout>;
    const elapsed = lastSyncedAt ? Date.now() - new Date(lastSyncedAt).getTime() : 0;

    const runSync = () => {
      if (disposed) return;
      mutateSync(undefined, {
        onError: () => {
          if (!disposed) timeout = setTimeout(runSync, AUTO_SYNC_AFTER_MS);
        },
      });
    };

    timeout = setTimeout(runSync, Math.max(0, AUTO_SYNC_AFTER_MS - elapsed));

    return () => {
      disposed = true;
      clearTimeout(timeout);
    };
  }, [connected, lastSyncedAt, mutateSync]);

  const value = useMemo<KnownKanjiContextValue>(
    () => ({
      active: query.isSuccess,
      knownKanji: new Set(query.data?.kanji ?? []),
    }),
    [query.data?.kanji, query.isSuccess]
  );

  return <KnownKanjiContextProvider {...value}>{children}</KnownKanjiContextProvider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useKnownKanjiContext = () => useContext(KnownKanjiContext);
