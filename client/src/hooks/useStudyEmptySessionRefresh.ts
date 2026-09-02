import { useEffect, type MutableRefObject } from 'react';
import type { StudyOverview } from '@languageflow/shared/src/types';

import type useStudyBackgroundTask from './useStudyBackgroundTask';

const RETRY_PADDING_MS = 250;
const MAX_TIMEOUT_MS = 2_147_483_647;

type RunBackgroundTask = ReturnType<typeof useStudyBackgroundTask>;

export type StudyEmptySessionRefreshPlan =
  | { kind: 'now' }
  | { kind: 'later'; delayMs: number }
  | null;

const getNextDueTime = (nextDueAt: string | null | undefined) => {
  if (!nextDueAt) return null;

  const nextDueTime = new Date(nextDueAt).getTime();
  return Number.isNaN(nextDueTime) ? null : nextDueTime;
};

export const planStudyEmptySessionRefresh = (
  overview: StudyOverview,
  now: number
): StudyEmptySessionRefreshPlan => {
  if (overview.dueCount > 0) return { kind: 'now' };
  if ((overview.failedCount ?? 0) <= 0) return null;

  const nextDueTime = getNextDueTime(overview.nextDueAt);
  if (nextDueTime === null) return null;
  if (nextDueTime <= now) return { kind: 'now' };

  return {
    kind: 'later',
    delayMs: Math.min(nextDueTime - now + RETRY_PADDING_MS, MAX_TIMEOUT_MS),
  };
};

interface UseStudyEmptySessionRefreshOptions {
  autoRefreshEmptySessionRef: MutableRefObject<boolean>;
  blocked: boolean;
  getCachedOverview: () => StudyOverview | null;
  loadSession: (kind: 'reviews', options: { allowEmptySessionRefresh: false }) => Promise<unknown>;
  runBackgroundTask: RunBackgroundTask;
  sessionOverview?: StudyOverview | null;
}

const useStudyEmptySessionRefresh = ({
  autoRefreshEmptySessionRef,
  blocked,
  getCachedOverview,
  loadSession,
  runBackgroundTask,
  sessionOverview,
}: UseStudyEmptySessionRefreshOptions) => {
  useEffect(() => {
    if (blocked || !autoRefreshEmptySessionRef.current) return undefined;

    const overview = sessionOverview ?? getCachedOverview();
    if (!overview) return undefined;

    const plan = planStudyEmptySessionRefresh(overview, Date.now());
    if (!plan) return undefined;

    const refreshSession = () =>
      runBackgroundTask(() => loadSession('reviews', { allowEmptySessionRefresh: false }), {
        label: plan.kind === 'now' ? 'Study session refresh' : 'Study failed-card retry refresh',
      });

    if (plan.kind === 'now') {
      refreshSession();
      return undefined;
    }

    const timeoutId = window.setTimeout(refreshSession, plan.delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [
    autoRefreshEmptySessionRef,
    blocked,
    getCachedOverview,
    loadSession,
    runBackgroundTask,
    sessionOverview,
  ]);
};

export default useStudyEmptySessionRefresh;
