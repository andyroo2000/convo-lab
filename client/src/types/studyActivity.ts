export type StudyActivityCategory = 'review' | 'create' | 'immerse' | 'conversation' | 'wanikani';
export type StudyActivityKind =
  | 'card_review'
  | 'daily_audio'
  | 'card_creation'
  | 'tv'
  | 'podcast'
  | 'reading'
  | 'conversation'
  | 'wanikani_review'
  | 'other';
export type StudyActivitySource = 'automatic' | 'manual' | 'calendar';

export interface StudyActivitySession {
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

export interface ActiveStudyActivity {
  clientSessionId: string;
  category: StudyActivityCategory;
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
