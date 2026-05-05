import type { StudyCardType } from '@languageflow/shared/src/types.js';

export type DailyAudioPracticeTrackMode = 'drill' | 'dialogue' | 'story';

export interface DailyAudioLearningAtom {
  cardId: string;
  cardType: StudyCardType;
  targetText: string;
  reading?: string | null;
  english: string;
  exampleJp?: string | null;
  exampleEn?: string | null;
  deckName?: string | null;
  noteType?: string | null;
}

export interface DailyAudioSelectionSummary {
  totalCandidates: number;
  totalEligible: number;
  selectedCount: number;
  dueCount: number;
  learningCount: number;
  recentMissCount: number;
}

export interface DailyAudioSelectedCard {
  id: string;
  cardType: string;
  queueState: string;
  dueAt: Date | null;
  introducedAt: Date | null;
  lastReviewedAt: Date | null;
  updatedAt: Date;
  sourceLapses: number | null;
  sourceDeckName: string | null;
  promptJson: unknown;
  answerJson: unknown;
  note?: {
    sourceNotetypeName?: string | null;
    rawFieldsJson?: unknown;
  } | null;
}
