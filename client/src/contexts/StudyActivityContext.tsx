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

interface StartOptions {
  category: StudyActivityCategory;
  activity: StudyActivityKind;
  source: StudyActivitySource;
  name?: string;
}

interface StudyActivityContextValue {
  active: ActiveStudyActivity | null;
  elapsedMs: number;
  start: (options: StartOptions) => void;
  stop: (activity?: StudyActivityKind, name?: string) => void;
  addCreatedCards: (count?: number) => void;
}

const inactiveStudyActivityContext: StudyActivityContextValue = {
  active: null,
  elapsedMs: 0,
  start: () => undefined,
  stop: () => undefined,
  addCreatedCards: () => undefined,
};

const StudyActivityContext = createContext<StudyActivityContextValue>(inactiveStudyActivityContext);

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
}: {
  children: ReactNode;
  userId: string | number;
}) => {
  const queryClient = useQueryClient();
  const activeKey = `${ACTIVE_KEY_PREFIX}.${userId}`;
  const pendingKey = `${PENDING_KEY_PREFIX}.${userId}`;
  const [active, setActive] = useState<ActiveStudyActivity | null>(() =>
    readJson<ActiveStudyActivity | null>(activeKey, null)
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
        (expectedName && current.name !== expectedName)
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
    [activeKey, finishActive]
  );

  const addCreatedCards = useCallback(
    (count = 1) => {
      const { current } = activeRef;
      if (!current || current.activity !== 'card_creation') return;
      const next = { ...current, cardsCreated: current.cardsCreated + count };
      activeRef.current = next;
      setActive(next);
      localStorage.setItem(activeKey, JSON.stringify(next));
    },
    [activeKey]
  );

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
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
    const { current } = activeRef;
    if (!current || current.source !== 'automatic') return;
    const startedAt = new Date(current.startedAt).getTime();
    if (!Number.isFinite(startedAt) || Date.now() - startedAt <= AUTOMATIC_RECOVERY_LIMIT_MS)
      return;
    finishActive(current.activity, current.name, new Date(startedAt + AUTOMATIC_RECOVERY_LIMIT_MS));
  }, [finishActive]);

  useEffect(() => {
    const tick = () => {
      const { current } = activeRef;
      setElapsedMs(current ? Math.max(0, Date.now() - new Date(current.startedAt).getTime()) : 0);
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const value = useMemo(
    () => ({ active, elapsedMs, start, stop: finishActive, addCreatedCards }),
    [active, addCreatedCards, elapsedMs, finishActive, start]
  );

  return <StudyActivityContext.Provider value={value}>{children}</StudyActivityContext.Provider>;
};

// The timer hook intentionally shares the provider module so its context cannot drift.
// eslint-disable-next-line react-refresh/only-export-components
export function useStudyActivityTimer() {
  return useContext(StudyActivityContext);
}
