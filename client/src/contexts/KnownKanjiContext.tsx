import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';

import { useFeatureFlags } from '../hooks/useFeatureFlags';
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
  const { flags } = useFeatureFlags();
  const attemptedSyncRef = useRef<string | null>(null);
  const lastSyncedAt = query.data?.wanikani.lastSyncedAt ?? null;

  useEffect(() => {
    if (
      !flags?.studyApiSettingsWrite ||
      !query.data?.wanikani.connected ||
      !lastSyncedAt ||
      Date.now() - new Date(lastSyncedAt).getTime() < AUTO_SYNC_AFTER_MS ||
      attemptedSyncRef.current === lastSyncedAt
    ) {
      return;
    }

    attemptedSyncRef.current = lastSyncedAt;
    sync.mutate(undefined, { onError: () => undefined });
  }, [flags?.studyApiSettingsWrite, lastSyncedAt, query.data?.wanikani.connected, sync]);

  const value = useMemo<KnownKanjiContextValue>(
    () => ({
      active: query.enabled && query.isSuccess,
      knownKanji: new Set(query.data?.kanji ?? []),
    }),
    [query.data?.kanji, query.enabled, query.isSuccess]
  );

  return <KnownKanjiContextProvider {...value}>{children}</KnownKanjiContextProvider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useKnownKanjiContext = () => useContext(KnownKanjiContext);
