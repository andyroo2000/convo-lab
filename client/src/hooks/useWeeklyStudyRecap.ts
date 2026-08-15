import { useQuery } from '@tanstack/react-query';

import { notifyAuthSessionExpired } from '../lib/authSession';
import { fetchWithCsrf } from '../lib/csrf';
import { studyApiPath } from '../lib/studyApi';

export type WeeklyRecapCategories = Record<
  'review' | 'listen' | 'create' | 'immerse' | 'conversation' | 'wanikani',
  number
>;

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
// Learning OS numbers Sunday as 1, so Monday is 2.
export const WEEK_STARTS_ON = 2;

export function useWeeklyStudyRecap() {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  return useQuery({
    queryKey: [...weeklyStudyRecapKey, timezone, WEEK_STARTS_ON],
    queryFn: async () => {
      const response = await fetchWithCsrf(
        studyApiPath(
          `/weekly-recap?timezone=${encodeURIComponent(timezone)}&weekStartsOn=${WEEK_STARTS_ON}`
        ),
        { credentials: 'include', headers: { Accept: 'application/json' } }
      );
      notifyAuthSessionExpired(response);
      if (!response.ok) throw new Error('Unable to load the weekly study recap.');
      return response.json() as Promise<WeeklyStudyRecap>;
    },
  });
}
