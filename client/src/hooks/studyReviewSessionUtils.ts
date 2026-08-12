import type { StudyCardSummary, StudyOverview } from '@languageflow/shared/src/types';

import type { StudySessionResponse } from './useStudy';

export interface StudyUndoSnapshot {
  session: StudySessionResponse | null;
  overview: StudyOverview | null;
  currentIndex: number;
  revealed: boolean;
  answeredCardIds: string[];
}

export type StudyUndoAction =
  | {
      kind: 'reveal';
      snapshot: StudyUndoSnapshot;
    }
  | {
      kind: 'bury';
      snapshot: StudyUndoSnapshot;
    }
  | {
      kind: 'grade';
      snapshot: StudyUndoSnapshot;
      reviewLogId: string;
    };

export const cloneStudySnapshot = (snapshot: StudyUndoSnapshot): StudyUndoSnapshot =>
  structuredClone(snapshot);

export const isCardEligibleForSession = (card: StudyCardSummary) => {
  if (card.state.queueState === 'new') return !card.state.failedAt;
  if (!['learning', 'review', 'relearning'].includes(card.state.queueState)) {
    return false;
  }
  if (!card.state.dueAt) return false;
  return new Date(card.state.dueAt).getTime() <= Date.now();
};

export const hasPersistedFailure = (card: StudyCardSummary) => Boolean(card.state.failedAt);

export const orderStudySessionCards = (cards: StudyCardSummary[]) =>
  [...cards].sort((left, right) => {
    const leftIsNew = left.state.queueState === 'new';
    const rightIsNew = right.state.queueState === 'new';
    if (leftIsNew !== rightIsNew) return leftIsNew ? 1 : -1;
    if (leftIsNew && rightIsNew) return 0;

    const leftDueAt = left.state.dueAt
      ? new Date(left.state.dueAt).getTime()
      : Number.MAX_SAFE_INTEGER;
    const rightDueAt = right.state.dueAt
      ? new Date(right.state.dueAt).getTime()
      : Number.MAX_SAFE_INTEGER;
    if (leftDueAt !== rightDueAt) return leftDueAt - rightDueAt;

    return left.id.localeCompare(right.id);
  });

export const getCardsAfterReview = (
  currentCards: StudyCardSummary[],
  updatedCard: StudyCardSummary,
  grade: 'again' | 'hard' | 'good' | 'easy'
) => {
  let nextCards = currentCards.filter((card) => card.id !== updatedCard.id);

  if (grade === 'again' && hasPersistedFailure(updatedCard)) {
    nextCards = nextCards.filter((card) => card.state.queueState !== 'new');
    if (isCardEligibleForSession(updatedCard)) {
      nextCards.push(updatedCard);
    }
  }

  return orderStudySessionCards(nextCards);
};
