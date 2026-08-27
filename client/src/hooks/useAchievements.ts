import { useCallback, useEffect, useState } from 'react';

import {
  AchievementContractError,
  type AchievementCatalog,
  type AchievementProgress,
} from '../components/study/achievementModel';
import { getAchievementCatalog, getAchievementProgress } from '../lib/achievementApi';

interface AchievementState {
  catalog: AchievementCatalog | null;
  progress: AchievementProgress | null;
  loading: boolean;
  error: Error | null;
  progressError: Error | null;
}

const useAchievements = () => {
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<AchievementState>({
    catalog: null,
    progress: null,
    loading: true,
    error: null,
    progressError: null,
  });

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({
      ...current,
      loading: current.catalog === null,
      error: null,
      progressError: null,
    }));

    getAchievementCatalog()
      .then(async (catalog) => {
        let progress: AchievementProgress | null = null;
        let progressError: Error | null = null;
        try {
          progress = await getAchievementProgress();
        } catch (reason: unknown) {
          progressError =
            reason instanceof Error
              ? reason
              : new Error('Achievement progress could not be loaded.');
          const context =
            reason instanceof AchievementContractError
              ? 'Achievement progress response did not match its contract.'
              : 'Achievement progress could not be loaded.';
          console.error(context, progressError);
        }
        if (!cancelled) {
          setState({ catalog, progress, loading: false, error: null, progressError });
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setState({
            catalog: null,
            progress: null,
            loading: false,
            progressError: null,
            error:
              reason instanceof Error ? reason : new Error('Achievements could not be loaded.'),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return {
    ...state,
    retry: useCallback(() => setReloadKey((key) => key + 1), []),
  };
};

export default useAchievements;
