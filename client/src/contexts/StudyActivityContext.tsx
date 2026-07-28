import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { saveStudyActivitySessions, studyActivityKeys } from '../hooks/useStudyActivity';
import type {
  ActiveStudyActivity,
  StudyActivityCategory,
  StudyActivityKind,
  StudyActivitySession,
  StudyActivitySource,
} from '../types/studyActivity';

const ACTIVE_KEY_PREFIX = 'convolab.studyActivity.active.v1';
const PENDING_KEY_PREFIX = 'convolab.studyActivity.pending.v1';
const AUTOMATIC_RECOVERY_LIMIT_MS = 5 * 60 * 1000;
const MANUAL_RECOVERY_LIMIT_MS = 6 * 60 * 60 * 1000;

interface StartOptions {
  category: StudyActivityCategory;
  activity: StudyActivityKind;
  source: StudyActivitySource;
  name?: string;
}

interface StudyActivityActionsContextValue {
  start: (options: StartOptions) => void;
  stop: (activity?: StudyActivityKind, name?: string) => void;
  addCreatedCards: (count?: number) => void;
  logCompleted: (session: StudyActivitySession) => void;
}

interface StudyActivityStatusContextValue {
  active: ActiveStudyActivity | null;
  elapsedMs: number;
}

const inactiveStudyActivityActions: StudyActivityActionsContextValue = {
  start: () => undefined,
  stop: () => undefined,
  addCreatedCards: () => undefined,
  logCompleted: () => undefined,
};

const StudyActivityActionsContext = createContext<StudyActivityActionsContextValue>(
  inactiveStudyActivityActions
);
const StudyActivityStatusContext = createContext<StudyActivityStatusContextValue>({
  active: null,
  elapsedMs: 0,
});

function readJson<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function queuePending(key: string, session: StudyActivitySession) {
  const pending = readJson<StudyActivitySession[]>(key, []);
  const next = [
    ...pending.filter((item) => item.clientSessionId !== session.clientSessionId),
    session,
  ];
  localStorage.setItem(key, JSON.stringify(next));
}

function sessionFromActive(
  active: ActiveStudyActivity,
  endedAt = new Date()
): StudyActivitySession {
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

export const StudyActivityProvider = ({
  children,
  userId,
  enabled = true,
}: {
  children: ReactNode;
  userId: string | number;
  enabled?: boolean;
}) => {
  const queryClient = useQueryClient();
  const activeKey = `${ACTIVE_KEY_PREFIX}.${userId}`;
  const pendingKey = `${PENDING_KEY_PREFIX}.${userId}`;
  const [active, setActive] = useState<ActiveStudyActivity | null>(() =>
    enabled ? readJson<ActiveStudyActivity | null>(activeKey, null) : null
  );
  const activeRef = useRef(active);
  const [elapsedMs, setElapsedMs] = useState(0);

  const persistCompleted = useCallback(
    (session: StudyActivitySession) => {
      queuePending(pendingKey, session);
      saveStudyActivitySessions([session])
        .then(() => {
          const pending = readJson<StudyActivitySession[]>(pendingKey, []);
          localStorage.setItem(
            pendingKey,
            JSON.stringify(
              pending.filter((item) => item.clientSessionId !== session.clientSessionId)
            )
          );
          queryClient.invalidateQueries({ queryKey: studyActivityKeys.all });
        })
        .catch(() => {
          // The local queue is flushed on the next authenticated app load.
        });
    },
    [pendingKey, queryClient]
  );

  const finishActive = useCallback(
    (expectedActivity?: StudyActivityKind, expectedName?: string, endedAt: Date = new Date()) => {
      const { current } = activeRef;
      if (
        !current ||
        (expectedActivity && current.activity !== expectedActivity) ||
        (expectedName !== undefined && current.name !== expectedName)
      ) {
        return;
      }
      activeRef.current = null;
      setActive(null);
      localStorage.removeItem(activeKey);
      persistCompleted(sessionFromActive(current, endedAt));
    },
    [activeKey, persistCompleted]
  );

  const start = useCallback(
    (options: StartOptions) => {
      if (!enabled) return;
      const { current } = activeRef;
      if (
        current?.activity === options.activity &&
        current.source === options.source &&
        current.name === options.name
      ) {
        return;
      }
      if (current?.source === 'manual' && options.source === 'automatic') return;
      if (current) finishActive();
      const next: ActiveStudyActivity = {
        ...options,
        clientSessionId: crypto.randomUUID(),
        startedAt: new Date().toISOString(),
        cardsCreated: 0,
      };
      activeRef.current = next;
      setActive(next);
      localStorage.setItem(activeKey, JSON.stringify(next));
    },
    [activeKey, enabled, finishActive]
  );

  const addCreatedCards = useCallback(
    (count = 1) => {
      const { current } = activeRef;
      if (!current || current.activity !== 'card_creation') {
        const now = new Date().toISOString();
        persistCompleted({
          clientSessionId: crypto.randomUUID(),
          category: 'create',
          activity: 'card_creation',
          source: 'automatic',
          startedAt: now,
          endedAt: now,
          durationMs: 0,
          cardsCreated: count,
        });
        return;
      }
      const next = { ...current, cardsCreated: current.cardsCreated + count };
      activeRef.current = next;
      setActive(next);
      localStorage.setItem(activeKey, JSON.stringify(next));
    },
    [activeKey, persistCompleted]
  );

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    if (!enabled) finishActive();
  }, [enabled, finishActive]);

  const flushPending = useCallback(() => {
    const pending = readJson<StudyActivitySession[]>(pendingKey, []);
    if (!pending.length) return;
    saveStudyActivitySessions(pending)
      .then(() => {
        localStorage.removeItem(pendingKey);
        queryClient.invalidateQueries({ queryKey: studyActivityKeys.all });
      })
      .catch(() => undefined);
  }, [pendingKey, queryClient]);

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

  useEffect(() => {
    const { current } = activeRef;
    if (!current) return;
    const startedAt = new Date(current.startedAt).getTime();
    const recoveryLimit =
      current.source === 'automatic' ? AUTOMATIC_RECOVERY_LIMIT_MS : MANUAL_RECOVERY_LIMIT_MS;
    if (!Number.isFinite(startedAt) || Date.now() - startedAt <= recoveryLimit) return;
    finishActive(current.activity, current.name, new Date(startedAt + recoveryLimit));
  }, [finishActive]);

  useEffect(() => {
    const synchronizeActive = (event: StorageEvent) => {
      if (event.key !== activeKey) return;
      const next = readJson<ActiveStudyActivity | null>(activeKey, null);
      activeRef.current = next;
      setActive(next);
    };
    window.addEventListener('storage', synchronizeActive);
    return () => window.removeEventListener('storage', synchronizeActive);
  }, [activeKey]);

  useEffect(() => {
    const tick = () => {
      const { current } = activeRef;
      if (!current) {
        setElapsedMs(0);
        return;
      }
      const startedAt = new Date(current.startedAt).getTime();
      const recoveryLimit =
        current.source === 'automatic' ? AUTOMATIC_RECOVERY_LIMIT_MS : MANUAL_RECOVERY_LIMIT_MS;
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
  }, [finishActive]);

  const actionsValue = useMemo(
    () => ({
      start,
      stop: finishActive,
      addCreatedCards,
      logCompleted: persistCompleted,
    }),
    [addCreatedCards, finishActive, persistCompleted, start]
  );
  const statusValue = useMemo(() => ({ active, elapsedMs }), [active, elapsedMs]);

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
