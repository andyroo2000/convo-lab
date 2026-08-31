import type { StudyActivityCategory, StudyActivityKind } from '@languageflow/shared/src/types';

export type { StudyActivityCategory, StudyActivityKind } from '@languageflow/shared/src/types';
export { STUDY_ACTIVITY_CATEGORIES, STUDY_ACTIVITY_KINDS } from '@languageflow/shared/src/types';
export type StudyActivitySource = 'automatic' | 'manual' | 'calendar';
export const STUDY_ACTIVITY_ORIGINS = [
  'legacy',
  'ios',
  'web',
  'google_calendar',
  'wanikani',
  'system',
] as const;
export type StudyActivityOrigin = (typeof STUDY_ACTIVITY_ORIGINS)[number];
export type StudyActivityProvider = Extract<StudyActivityOrigin, 'google_calendar' | 'wanikani'>;

export interface StudyActivitySessionInput {
  id?: string;
  clientSessionId: string;
  category: StudyActivityCategory;
  activity: StudyActivityKind;
  source: StudyActivitySource;
  name?: string | null;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  audioPlaybackMs?: number | null;
  cardsCreated?: number | null;
}

export interface StudyActivitySession extends StudyActivitySessionInput {
  editable: boolean;
  origin: StudyActivityOrigin;
  provider: StudyActivityProvider | null;
}

export interface ActiveStudyActivity {
  clientSessionId: string;
  category?: StudyActivityCategory;
  activity: StudyActivityKind;
  source: StudyActivitySource;
  name?: string;
  startedAt: string;
  cardsCreated: number;
}

export type StudyTimeRange = 'today' | 'week' | 'month' | 'year' | 'all';

export interface StudyTimeAnalyticsBucket {
  startsAt: string;
  endsAt: string;
  totalMs: number;
  categories: Record<StudyActivityCategory, number>;
}

export interface StudyTimeAnalyticsRange {
  key: StudyTimeRange;
  startsAt: string;
  endsAt: string;
  bucketUnit?: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
  bucketStep?: number;
  totalMs: number;
  categories: Record<StudyActivityCategory, number>;
  buckets: StudyTimeAnalyticsBucket[];
}

export interface StudyTimeAnalytics {
  generatedAt: string;
  anchorDate: string;
  timezone: string;
  ranges: StudyTimeAnalyticsRange[];
}
