import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type ReactNode,
  type SetStateAction,
} from 'react';

import { saveStudyActivitySessions, studyActivityKeys } from '../hooks/useStudyActivity';
import { useStudyCapabilities } from '../hooks/useStudyCapabilities';
import type {
  ActiveStudyActivity,
  StudyActivityCategory,
  StudyActivityKind,
  StudyActivitySessionInput,
  StudyActivitySource,
} from '../types/studyActivity';

const ACTIVE_KEY_PREFIX = 'convolab.studyActivity.active.v1';
const PENDING_KEY_PREFIX = 'convolab.studyActivity.pending.v1';
const AUTOMATIC_RECOVERY_LIMIT_MS = 5 * 60 * 1000;
const MANUAL_RECOVERY_LIMIT_MS = 6 * 60 * 60 * 1000;

interface StartOptions {
  activity: StudyActivityKind;
  source: StudyActivitySource;
  name?: string;
}

type StudyActivitySessionDraft = Omit<StudyActivitySessionInput, 'category'>;
type CategoriesByActivity = Record<StudyActivityKind, StudyActivityCategory>;
type ActiveRef = MutableRefObject<ActiveStudyActivity | null>;
type SetActive = Dispatch<SetStateAction<ActiveStudyActivity | null>>;
type PersistCompleted = (session: StudyActivitySessionDraft) => Promise<void>;

interface StudyActivityActionsContextValue {
  start: (options: StartOptions) => void;
  stop: (activity?: StudyActivityKind, name?: string) => void;
  stopAndWait: (activity?: StudyActivityKind, name?: string) => Promise<void>;
  addCreatedCards: (count?: number) => void;
  logCompleted: (session: StudyActivitySessionDraft) => void;
  logCompletedAndWait: (session: StudyActivitySessionDraft) => Promise<void>;
}

interface StudyActivityStatusContextValue {
  active: ActiveStudyActivity | null;
  elapsedMs: number;
  enabled: boolean;
}

const inactiveStudyActivityActions: StudyActivityActionsContextValue = {
  start: () => undefined,
  stop: () => undefined,
  stopAndWait: () => Promise.resolve(),
  addCreatedCards: () => undefined,
  logCompleted: () => undefined,
  logCompletedAndWait: () => Promise.resolve(),
};

const StudyActivityActionsContext = createContext<StudyActivityActionsContextValue>(
  inactiveStudyActivityActions
);
const StudyActivityStatusContext = createContext<StudyActivityStatusContextValue>({
  active: null,
  elapsedMs: 0,
  enabled: false,
});

function readJson<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function queuePending(key: string, session: StudyActivitySessionDraft) {
  const pending = readJson<StudyActivitySessionDraft[]>(key, []);
  const next = [
    ...pending.filter((item) => item.clientSessionId !== session.clientSessionId),
    session,
  ];
  localStorage.setItem(key, JSON.stringify(next));
}

function acknowledgePending(key: string, clientSessionIds: Iterable<string>) {
  const acknowledged = new Set(clientSessionIds);
  const pending = readJson<StudyActivitySessionDraft[]>(key, []);
  const remaining = pending.filter((item) => !acknowledged.has(item.clientSessionId));

  if (remaining.length) {
    localStorage.setItem(key, JSON.stringify(remaining));
  } else {
    localStorage.removeItem(key);
  }
}

function sessionFromActive(
  active: ActiveStudyActivity,
  endedAt = new Date()
): StudyActivitySessionDraft {
  const startedAt = new Date(active.startedAt);
  const durationMs = Math.max(0, Math.min(86_400_000, endedAt.getTime() - startedAt.getTime()));
  return {
    ...active,
    endedAt: endedAt.toISOString(),
    durationMs,
    audioPlaybackMs: active.activity === 'daily_audio' ? durationMs : null,
    cardsCreated: active.cardsCreated || null,
  };
}

function unownedSessions(
  sessions: StudyActivitySessionDraft[],
  inFlightSessions: Map<string, Promise<void>>
) {
  return sessions.filter((session) => !inFlightSessions.has(session.clientSessionId));
}

function categorizeSessions(
  sessions: StudyActivitySessionDraft[],
  categoriesByActivity: CategoriesByActivity
): StudyActivitySessionInput[] {
  return sessions.map((session) => ({
    ...session,
    category: categoriesByActivity[session.activity],
  }));
}

function createPersistenceRequest({
  sessions,
  categoriesByActivity,
  pendingKey,
  inFlightSessions,
  invalidate,
}: {
  sessions: StudyActivitySessionDraft[];
  categoriesByActivity: CategoriesByActivity;
  pendingKey: string;
  inFlightSessions: Map<string, Promise<void>>;
  invalidate: () => Promise<void>;
}) {
  const sessionIds = sessions.map((session) => session.clientSessionId);
  const request = saveStudyActivitySessions(categorizeSessions(sessions, categoriesByActivity))
    .then(async () => {
      acknowledgePending(pendingKey, sessionIds);
      await invalidate();
    })
    .catch(() => {
      // The local queue is flushed on the next authenticated app load.
    })
    .finally(() => {
      sessionIds.forEach((sessionId) => {
        if (inFlightSessions.get(sessionId) === request) inFlightSessions.delete(sessionId);
      });
    });

  sessionIds.forEach((sessionId) => inFlightSessions.set(sessionId, request));
  return request;
}

function useSessionPersistence(
  categoriesByActivity: CategoriesByActivity | undefined,
  pendingKey: string
) {
  const queryClient = useQueryClient();
  const inFlightSessionsRef = useRef(new Map<string, Promise<void>>());
  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: studyActivityKeys.all }),
    [queryClient]
  );

  const persistSessions = useCallback(
    (sessions: StudyActivitySessionDraft[]) => {
      if (!categoriesByActivity) return Promise.resolve();
      const inFlightSessions = inFlightSessionsRef.current;
      const unowned = unownedSessions(sessions, inFlightSessions);
      if (unowned.length) {
        createPersistenceRequest({
          sessions: unowned,
          categoriesByActivity,
          pendingKey,
          inFlightSessions,
          invalidate,
        });
      }
      return Promise.all(
        sessions.map((session) => inFlightSessions.get(session.clientSessionId))
      ).then(() => undefined);
    },
    [categoriesByActivity, invalidate, pendingKey]
  );

  const persistCompleted = useCallback(
    (session: StudyActivitySessionDraft) => {
      queuePending(pendingKey, session);
      return persistSessions([session]);
    },
    [pendingKey, persistSessions]
  );
  return { persistSessions, persistCompleted };
}

function updateActive(
  activeRef: ActiveRef,
  setActive: SetActive,
  activeKey: string,
  next: ActiveStudyActivity | null
) {
  const mutableActiveRef = activeRef;
  mutableActiveRef.current = next;
  setActive(next);
  if (next) localStorage.setItem(activeKey, JSON.stringify(next));
  else localStorage.removeItem(activeKey);
}

function useFinishActive(
  activeRef: ActiveRef,
  setActive: SetActive,
  activeKey: string,
  persistCompleted: PersistCompleted
) {
  return useCallback(
    (expectedActivity?: StudyActivityKind, expectedName?: string, endedAt: Date = new Date()) => {
      const { current } = activeRef;
      if (!current) return Promise.resolve();
      if (expectedActivity && current.activity !== expectedActivity) return Promise.resolve();
      if (expectedName !== undefined && current.name !== expectedName) return Promise.resolve();
      updateActive(activeRef, setActive, activeKey, null);
      return persistCompleted(sessionFromActive(current, endedAt));
    },
    [activeKey, activeRef, persistCompleted, setActive]
  );
}

function matchesActivity(current: ActiveStudyActivity, options: StartOptions) {
  return (
    current.activity === options.activity &&
    current.source === options.source &&
    current.name === options.name
  );
}

function shouldKeepCurrentActivity(current: ActiveStudyActivity | null, options: StartOptions) {
  if (!current) return false;
  if (matchesActivity(current, options)) return true;
  return current.source === 'manual' && options.source === 'automatic';
}

function beginActivity({
  options,
  activeRef,
  setActive,
  activeKey,
  categoriesByActivity,
  enabled,
  finishActive,
}: {
  options: StartOptions;
  activeRef: ActiveRef;
  setActive: SetActive;
  activeKey: string;
  categoriesByActivity: CategoriesByActivity | undefined;
  enabled: boolean;
  finishActive: (activity?: StudyActivityKind, name?: string, endedAt?: Date) => Promise<void>;
}) {
  if (!enabled) return;
  const { current } = activeRef;
  if (shouldKeepCurrentActivity(current, options)) return;
  if (current) finishActive();
  const next: ActiveStudyActivity = {
    ...options,
    ...(categoriesByActivity ? { category: categoriesByActivity[options.activity] } : {}),
    clientSessionId: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    cardsCreated: 0,
  };
  updateActive(activeRef, setActive, activeKey, next);
}

function useStartActivity({
  activeRef,
  setActive,
  activeKey,
  categoriesByActivity,
  enabled,
  finishActive,
}: {
  activeRef: ActiveRef;
  setActive: SetActive;
  activeKey: string;
  categoriesByActivity: CategoriesByActivity | undefined;
  enabled: boolean;
  finishActive: (activity?: StudyActivityKind, name?: string, endedAt?: Date) => Promise<void>;
}) {
  return useCallback(
    (options: StartOptions) =>
      beginActivity({
        options,
        activeRef,
        setActive,
        activeKey,
        categoriesByActivity,
        enabled,
        finishActive,
      }),
    [activeKey, activeRef, categoriesByActivity, enabled, finishActive, setActive]
  );
}

function useAddCreatedCards(
  activeRef: ActiveRef,
  setActive: SetActive,
  activeKey: string,
  persistCompleted: PersistCompleted
) {
  return useCallback(
    (count = 1) => {
      const { current } = activeRef;
      if (!current || current.activity !== 'card_creation') {
        const now = new Date().toISOString();
        persistCompleted({
          clientSessionId: crypto.randomUUID(),
          activity: 'card_creation',
          source: 'automatic',
          startedAt: now,
          endedAt: now,
          durationMs: 0,
          cardsCreated: count,
        });
        return;
      }
      updateActive(activeRef, setActive, activeKey, {
        ...current,
        cardsCreated: current.cardsCreated + count,
      });
    },
    [activeKey, activeRef, persistCompleted, setActive]
  );
}

function recoveryLimitFor(source: StudyActivitySource) {
  return source === 'automatic' ? AUTOMATIC_RECOVERY_LIMIT_MS : MANUAL_RECOVERY_LIMIT_MS;
}

function useActiveRefSynchronization(active: ActiveStudyActivity | null, activeRef: ActiveRef) {
  useEffect(() => {
    const mutableActiveRef = activeRef;
    mutableActiveRef.current = active;
  }, [active, activeRef]);
}

function useCategoryBackfill({
  activeRef,
  setActive,
  activeKey,
  categoriesByActivity,
}: {
  activeRef: ActiveRef;
  setActive: SetActive;
  activeKey: string;
  categoriesByActivity: CategoriesByActivity | undefined;
}) {
  useEffect(() => {
    const { current } = activeRef;
    if (!current || !categoriesByActivity) return;
    const category = categoriesByActivity[current.activity];
    if (!category || current.category === category) return;
    updateActive(activeRef, setActive, activeKey, { ...current, category });
  }, [activeKey, activeRef, categoriesByActivity, setActive]);
}

function useEnabledState(enabled: boolean, finishActive: () => Promise<void>) {
  useEffect(() => {
    if (!enabled) finishActive();
  }, [enabled, finishActive]);
}

function usePendingSessionFlush(
  pendingKey: string,
  persistSessions: (sessions: StudyActivitySessionDraft[]) => Promise<void>
) {
  const flushPending = useCallback(() => {
    const pending = readJson<StudyActivitySessionDraft[]>(pendingKey, []);
    if (pending.length) persistSessions(pending).catch(() => undefined);
  }, [pendingKey, persistSessions]);

  useEffect(() => {
    flushPending();
    window.addEventListener('online', flushPending);
    window.addEventListener('focus', flushPending);
    const interval = window.setInterval(flushPending, 60_000);
    return () => {
      window.removeEventListener('online', flushPending);
      window.removeEventListener('focus', flushPending);
      window.clearInterval(interval);
    };
  }, [flushPending]);
}

function useRecoveredActivityExpiry(
  activeRef: ActiveRef,
  finishActive: (activity?: StudyActivityKind, name?: string, endedAt?: Date) => Promise<void>
) {
  useEffect(() => {
    const { current } = activeRef;
    if (!current) return;
    const startedAt = new Date(current.startedAt).getTime();
    const recoveryLimit = recoveryLimitFor(current.source);
    if (!Number.isFinite(startedAt) || Date.now() - startedAt <= recoveryLimit) return;
    finishActive(current.activity, current.name, new Date(startedAt + recoveryLimit));
  }, [activeRef, finishActive]);
}

function useCrossTabSynchronization(activeRef: ActiveRef, setActive: SetActive, activeKey: string) {
  useEffect(() => {
    const synchronizeActive = (event: StorageEvent) => {
      if (event.key !== activeKey) return;
      const next = readJson<ActiveStudyActivity | null>(activeKey, null);
      const mutableActiveRef = activeRef;
      mutableActiveRef.current = next;
      setActive(next);
    };
    window.addEventListener('storage', synchronizeActive);
    return () => window.removeEventListener('storage', synchronizeActive);
  }, [activeKey, activeRef, setActive]);
}

function useElapsedActivityTime(
  activeRef: ActiveRef,
  finishActive: (activity?: StudyActivityKind, name?: string, endedAt?: Date) => Promise<void>
) {
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    const tick = () => {
      const { current } = activeRef;
      if (!current) {
        setElapsedMs(0);
        return;
      }
      const startedAt = new Date(current.startedAt).getTime();
      const recoveryLimit = recoveryLimitFor(current.source);
      const elapsed = Date.now() - startedAt;
      if (Number.isFinite(startedAt) && elapsed > recoveryLimit) {
        finishActive(current.activity, current.name, new Date(startedAt + recoveryLimit));
        setElapsedMs(0);
        return;
      }
      setElapsedMs(Math.max(0, elapsed));
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [activeRef, finishActive]);
  return elapsedMs;
}

function useActionsValue({
  start,
  finishActive,
  addCreatedCards,
  persistCompleted,
}: {
  start: StudyActivityActionsContextValue['start'];
  finishActive: StudyActivityActionsContextValue['stopAndWait'];
  addCreatedCards: StudyActivityActionsContextValue['addCreatedCards'];
  persistCompleted: PersistCompleted;
}) {
  return useMemo(
    () => ({
      start,
      stop: (...args: Parameters<typeof finishActive>) => {
        finishActive(...args).catch(() => undefined);
      },
      stopAndWait: finishActive,
      addCreatedCards,
      logCompleted: (session: StudyActivitySessionDraft) => {
        persistCompleted(session).catch(() => undefined);
      },
      logCompletedAndWait: persistCompleted,
    }),
    [addCreatedCards, finishActive, persistCompleted, start]
  );
}

export const StudyActivityProvider = ({
  children,
  userId,
  enabled = true,
}: {
  children: ReactNode;
  userId: string | number;
  enabled?: boolean;
}) => {
  const capabilitiesQuery = useStudyCapabilities(enabled);
  const categoriesByActivity = capabilitiesQuery.data?.studyActivity.categoriesByActivity;
  const activeKey = `${ACTIVE_KEY_PREFIX}.${userId}`;
  const pendingKey = `${PENDING_KEY_PREFIX}.${userId}`;
  const [active, setActive] = useState<ActiveStudyActivity | null>(() =>
    enabled ? readJson<ActiveStudyActivity | null>(activeKey, null) : null
  );
  const activeRef = useRef(active);
  const { persistSessions, persistCompleted } = useSessionPersistence(
    categoriesByActivity,
    pendingKey
  );
  const finishActive = useFinishActive(activeRef, setActive, activeKey, persistCompleted);
  const start = useStartActivity({
    activeRef,
    setActive,
    activeKey,
    categoriesByActivity,
    enabled,
    finishActive,
  });
  const addCreatedCards = useAddCreatedCards(activeRef, setActive, activeKey, persistCompleted);

  useActiveRefSynchronization(active, activeRef);
  useCategoryBackfill({ activeRef, setActive, activeKey, categoriesByActivity });
  useEnabledState(enabled, finishActive);
  usePendingSessionFlush(pendingKey, persistSessions);
  useRecoveredActivityExpiry(activeRef, finishActive);
  useCrossTabSynchronization(activeRef, setActive, activeKey);
  const elapsedMs = useElapsedActivityTime(activeRef, finishActive);
  const actionsValue = useActionsValue({ start, finishActive, addCreatedCards, persistCompleted });
  const statusValue = useMemo(() => ({ active, elapsedMs, enabled }), [active, elapsedMs, enabled]);

  return (
    <StudyActivityActionsContext.Provider value={actionsValue}>
      <StudyActivityStatusContext.Provider value={statusValue}>
        {children}
      </StudyActivityStatusContext.Provider>
    </StudyActivityActionsContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export function useStudyActivityActions() {
  return useContext(StudyActivityActionsContext);
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStudyActivityStatus() {
  return useContext(StudyActivityStatusContext);
}

// Kept for stateful timer UI and compatibility with focused provider tests.
// eslint-disable-next-line react-refresh/only-export-components
export function useStudyActivityTimer() {
  return { ...useStudyActivityActions(), ...useStudyActivityStatus() };
}
