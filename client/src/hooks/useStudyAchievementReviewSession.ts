import { useCallback, useMemo, useRef, type MutableRefObject } from 'react';

import { StudyAchievementSessionStore } from '../components/study/studyAchievementSessionModel';
import type { AchievementProgress } from '../components/study/achievementModel';
import type { StudySessionReviewRecord } from '../components/study/studySessionWrapUpModel';
import type useStudyBackgroundTask from './useStudyBackgroundTask';
import type { StudyAchievementSyncResult } from './useStudyAchievementSync';

const ACHIEVEMENT_PROGRESS_SESSION_START_FRESHNESS_MS = 60_000;

export interface AchievementSessionBootstrap {
  cancelled: boolean;
  promise: Promise<void> | null;
}

interface UseStudyAchievementReviewSessionOptions {
  achievementProgress: AchievementProgress | null;
  hasFreshAchievementProgress: (freshnessMs: number) => boolean;
  runBackgroundTask: ReturnType<typeof useStudyBackgroundTask>;
  syncAchievements: (evaluate?: boolean, force?: boolean) => Promise<StudyAchievementSyncResult>;
  userId: string | null;
}

const createSessionStore = (userId: string | null) => {
  if (!userId || typeof window === 'undefined') return null;
  return new StudyAchievementSessionStore(window.localStorage, userId);
};

const isActiveBootstrap = (
  bootstrap: AchievementSessionBootstrap,
  bootstrapRef: MutableRefObject<AchievementSessionBootstrap | null>
) => !bootstrap.cancelled && bootstrapRef.current === bootstrap;

const refreshSessionBaseline = async ({
  achievementSessionStore,
  bootstrap,
  bootstrapRef,
  hasFreshAchievementProgress,
  syncAchievements,
}: {
  achievementSessionStore: StudyAchievementSessionStore | null;
  bootstrap: AchievementSessionBootstrap;
  bootstrapRef: MutableRefObject<AchievementSessionBootstrap | null>;
  hasFreshAchievementProgress: (freshnessMs: number) => boolean;
  syncAchievements: (evaluate?: boolean) => Promise<StudyAchievementSyncResult>;
}) => {
  if (hasFreshAchievementProgress(ACHIEVEMENT_PROGRESS_SESSION_START_FRESHNESS_MS)) return;

  try {
    const currentAwards = (await syncAchievements(false)).progress.awards;
    if (!isActiveBootstrap(bootstrap, bootstrapRef)) return;
    achievementSessionStore?.refreshCurrentSessionBaseline(currentAwards);
  } catch {
    // Reviews remain available offline, using cached awards when available.
  }
};

const useStudyAchievementReviewSession = ({
  achievementProgress,
  hasFreshAchievementProgress,
  runBackgroundTask,
  syncAchievements,
  userId,
}: UseStudyAchievementReviewSessionOptions) => {
  const achievementSessionStore = useMemo(() => createSessionStore(userId), [userId]);
  const achievementSessionBootstrapRef = useRef<AchievementSessionBootstrap | null>(null);

  const startAchievementReviewSession = useCallback(() => {
    const bootstrap: AchievementSessionBootstrap = { cancelled: false, promise: null };
    if (achievementSessionBootstrapRef.current) {
      achievementSessionBootstrapRef.current.cancelled = true;
    }
    achievementSessionBootstrapRef.current = bootstrap;
    achievementSessionStore?.beginReviewSession(achievementProgress?.awards ?? []);
    bootstrap.promise = refreshSessionBaseline({
      achievementSessionStore,
      bootstrap,
      bootstrapRef: achievementSessionBootstrapRef,
      hasFreshAchievementProgress,
      syncAchievements,
    });
    runBackgroundTask(bootstrap.promise, { label: 'Study achievement-session bootstrap' });
    return bootstrap;
  }, [
    achievementProgress,
    achievementSessionStore,
    hasFreshAchievementProgress,
    runBackgroundTask,
    syncAchievements,
  ]);

  const recordAchievementReview = useCallback(
    (record: StudySessionReviewRecord) => achievementSessionStore?.recordReview(record),
    [achievementSessionStore]
  );
  const undoAchievementReview = useCallback(
    (reviewId: string) => achievementSessionStore?.undoReview(reviewId),
    [achievementSessionStore]
  );

  return {
    achievementSessionBootstrapRef,
    achievementSessionStore,
    recordAchievementReview,
    startAchievementReviewSession,
    undoAchievementReview,
  };
};

export default useStudyAchievementReviewSession;
