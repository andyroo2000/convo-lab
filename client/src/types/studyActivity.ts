export type StudyActivityCategory = 'review' | 'create' | 'immerse';
export type StudyActivityKind =
  | 'card_review'
  | 'daily_audio'
  | 'card_creation'
  | 'tv'
  | 'podcast'
  | 'reading'
  | 'conversation'
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
