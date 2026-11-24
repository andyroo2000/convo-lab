import type { StudyCardSummary } from '@languageflow/shared/src/types';

// This marker belongs to the local lesson/practice queue, never to the card's FSRS state.
const retryInBatch = Symbol('retryInBatch');

export const requeueForRetry = (card: StudyCardSummary) => ({ ...card, [retryInBatch]: true });

export const batchQueueCounts = (cards: StudyCardSummary[]) => {
  const failedDue = cards.filter((card) => retryInBatch in card).length;
  return { failedDue, reviewRemaining: cards.length - failedDue, newRemaining: 0 };
};
