import { useCallback, useRef, useState } from 'react';

import type { AchievementCatalog, AchievementProgress } from '../components/study/achievementModel';
import { getAchievementCatalog, getAchievementProgress } from '../lib/achievementApi';

export interface StudyAchievementSyncResult {
  catalog: AchievementCatalog;
  progress: AchievementProgress;
}

interface InFlightAchievementSync {
  evaluate: boolean;
  request: Promise<StudyAchievementSyncResult>;
}

const shouldReuseRequest = (
  inFlight: InFlightAchievementSync | null,
  evaluate: boolean,
  force: boolean
) => {
  if (force || !inFlight) return false;
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

const useStudyAchievementSync = () => {
  const [achievementCatalog, setAchievementCatalog] = useState<AchievementCatalog | null>(null);
  const [achievementProgress, setAchievementProgress] = useState<AchievementProgress | null>(null);
  const catalogRef = useRef<AchievementCatalog | null>(null);
  const progressSyncedAtRef = useRef<number | null>(null);
  const syncQueueRef = useRef<Promise<void>>(Promise.resolve());
  const inFlightRef = useRef<InFlightAchievementSync | null>(null);

  const syncAchievements = useCallback((evaluate = true, force = false) => {
    const inFlight = inFlightRef.current;
    if (shouldReuseRequest(inFlight, evaluate, force)) return inFlight!.request;

    const request = syncQueueRef.current
      .catch(() => undefined)
      .then(() => fetchAchievementState(catalogRef.current, evaluate))
      .then((result) => {
        catalogRef.current = result.catalog;
        progressSyncedAtRef.current = Date.now();
        setAchievementCatalog(result.catalog);
        setAchievementProgress(result.progress);
        return result;
      });
    inFlightRef.current = { evaluate, request };
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

  const hasFreshAchievementProgress = useCallback(
    (freshnessMs: number) => {
      if (!achievementProgress) return false;
      if (progressSyncedAtRef.current === null) return false;
      return Date.now() - progressSyncedAtRef.current <= freshnessMs;
    },
    [achievementProgress]
  );

  return {
    achievementCatalog,
    achievementProgress,
    hasFreshAchievementProgress,
    syncAchievements,
  };
};

export default useStudyAchievementSync;
