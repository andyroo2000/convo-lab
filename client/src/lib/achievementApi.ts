import {
  decodeAchievementCatalog,
  decodeAchievementProgress,
  type AchievementCatalog,
  type AchievementProgress,
} from '../components/study/achievementModel';
import { requestJson } from './apiClient';

export const getAchievementCatalog = async (): Promise<AchievementCatalog> =>
  decodeAchievementCatalog(await requestJson<unknown>('/api/achievements/catalog'));

export const getAchievementProgress = async (): Promise<AchievementProgress> =>
  decodeAchievementProgress(
    await requestJson<unknown>('/api/achievements/evaluate', { method: 'POST' })
  );
