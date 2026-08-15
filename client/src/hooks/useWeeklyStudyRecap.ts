import { useQuery } from '@tanstack/react-query';

import { notifyAuthSessionExpired } from '../lib/authSession';
import { fetchWithCsrf } from '../lib/csrf';
import { studyApiPath } from '../lib/studyApi';
import type { StudyActivityCategory } from '../types/studyActivity';
import { MONDAY_IN_LEARNING_OS_WEEKDAY_NUMBERING } from './useStudyActivity';

export type WeeklyRecapCategories = Record<StudyActivityCategory, number>;

interface WeeklyRecapStats {
  totalMs: number;
  activeDays: number;
  reviewCount: number;
  recallRate: number | null;
  newCardsIntroduced: number;
}

export interface WeeklyStudyRecap {
  generatedAt: string;
  week: WeeklyRecapStats & {
    startsAt: string;
    endsAt: string;
    bestDay: { date: string; totalMs: number } | null;
    categories: WeeklyRecapCategories;
  };
  previousWeek: WeeklyRecapStats;
}

export const weeklyStudyRecapKey = ['study', 'weekly-recap'] as const;

export function useWeeklyStudyRecap() {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  return useQuery({
    queryKey: [...weeklyStudyRecapKey, timezone, MONDAY_IN_LEARNING_OS_WEEKDAY_NUMBERING],
    queryFn: async () => {
      const response = await fetchWithCsrf(
        studyApiPath(
          `/weekly-recap?timezone=${encodeURIComponent(timezone)}&weekStartsOn=${MONDAY_IN_LEARNING_OS_WEEKDAY_NUMBERING}`
        ),
        { credentials: 'include', headers: { Accept: 'application/json' } }
      );
      notifyAuthSessionExpired(response);
      if (!response.ok) throw new Error('Unable to load the weekly study recap.');
      return response.json() as Promise<WeeklyStudyRecap>;
    },
  });
}
