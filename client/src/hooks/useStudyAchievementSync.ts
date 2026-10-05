import { useCallback, useRef, useState } from 'react';

import type { AchievementCatalog, AchievementProgress } from '../components/study/achievementModel';
import { getAchievementCatalog, getAchievementProgress } from '../lib/achievementApi';

export interface StudyAchievementSyncResult {
  catalog: AchievementCatalog;
  progress: AchievementProgress;
}

interface InFlightAchievementSync {
  evaluate: boolean;
  revision: number;
  request: Promise<StudyAchievementSyncResult>;
}

const shouldReuseRequest = (
  inFlight: InFlightAchievementSync | null,
  evaluate: boolean,
  force: boolean,
  revision: number
) => {
  if (force || !inFlight) return false;
  if (inFlight.revision !== revision) return false;
  return inFlight.evaluate || !evaluate;
};

const fetchAchievementState = async (
  cachedCatalog: AchievementCatalog | null,
  evaluate: boolean
): Promise<StudyAchievementSyncResult> => {
  const [catalog, progress] = await Promise.all([
    cachedCatalog ? Promise.resolve(cachedCatalog) : getAchievementCatalog(),
    getAchievementProgress({ evaluate }),
  ]);
  if (catalog.revision !== progress.revision) {
    throw new Error('Achievement catalog and progress revisions did not match.');
  }
  return { catalog, progress };
};

const isAchievementProgressFresh = (
  progress: AchievementProgress | null,
  syncedAt: number | null,
  freshnessMs: number
) => {
  if (!progress || syncedAt === null) return false;
  return Date.now() - syncedAt <= freshnessMs;
};

const useStudyAchievementSync = () => {
  const [achievementCatalog, setAchievementCatalog] = useState<AchievementCatalog | null>(null);
  const [achievementProgress, setAchievementProgress] = useState<AchievementProgress | null>(null);
  const catalogRef = useRef<AchievementCatalog | null>(null);
  const progressSyncedAtRef = useRef<number | null>(null);
  const syncQueueRef = useRef<Promise<void>>(Promise.resolve());
  const inFlightRef = useRef<InFlightAchievementSync | null>(null);
  const revisionRef = useRef(0);
  const needsEvaluationRef = useRef(false);

  const invalidateAchievementProgress = useCallback(() => {
    revisionRef.current += 1;
    needsEvaluationRef.current = true;
    progressSyncedAtRef.current = null;
    setAchievementProgress(null);
  }, []);

  const syncAchievements = useCallback((evaluate = true, force = false) => {
    const revision = revisionRef.current;
    const shouldEvaluate = evaluate || needsEvaluationRef.current;
    const inFlight = inFlightRef.current;
    if (shouldReuseRequest(inFlight, shouldEvaluate, force, revision)) return inFlight!.request;

    const request = syncQueueRef.current
      .catch(() => undefined)
      .then(() => fetchAchievementState(catalogRef.current, shouldEvaluate))
      .then((result) => {
        catalogRef.current = result.catalog;
        // An Undo can invalidate a response while the server is still evaluating it.
        if (revision !== revisionRef.current) return result;
        needsEvaluationRef.current = false;
        progressSyncedAtRef.current = Date.now();
        setAchievementCatalog(result.catalog);
        setAchievementProgress(result.progress);
        return result;
      });
    inFlightRef.current = { evaluate: shouldEvaluate, revision, request };
    syncQueueRef.current = request.then(
      () => undefined,
      () => undefined
    );
    const clearInFlightRequest = () => {
      if (inFlightRef.current?.request === request) inFlightRef.current = null;
    };
    request.then(clearInFlightRequest, clearInFlightRequest);
    return request;
  }, []);

  const refreshInvalidatedAchievements = useCallback(async () => {
    if (needsEvaluationRef.current) await syncAchievements();
  }, [syncAchievements]);

  const hasFreshAchievementProgress = useCallback(
    (freshnessMs: number) =>
      isAchievementProgressFresh(achievementProgress, progressSyncedAtRef.current, freshnessMs),
    [achievementProgress]
  );

  return {
    achievementCatalog,
    achievementProgress,
    hasFreshAchievementProgress,
    invalidateAchievementProgress,
    refreshInvalidatedAchievements,
    syncAchievements,
  };
};

export default useStudyAchievementSync;
