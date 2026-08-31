import {
  decodeAchievementCatalog,
  decodeAchievementProgress,
  type AchievementCatalog,
  type AchievementProgress,
} from '../components/study/achievementModel';
import { requestJson } from './apiClient';

export const getAchievementCatalog = async (): Promise<AchievementCatalog> =>
  decodeAchievementCatalog(await requestJson<unknown>('/api/achievements/catalog'));

interface GetAchievementProgressOptions {
  evaluate?: boolean;
}

export const getAchievementProgress = async (
  options: GetAchievementProgressOptions = {}
): Promise<AchievementProgress> =>
  decodeAchievementProgress(
    await requestJson<unknown>(
      options.evaluate === false ? '/api/achievements/progress' : '/api/achievements/evaluate',
      options.evaluate === false ? undefined : { method: 'POST' }
    )
  );
