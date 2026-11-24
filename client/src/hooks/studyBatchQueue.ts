import type { StudyCardSummary } from '@languageflow/shared/src/types';

const batchQueueCounts = (cards: StudyCardSummary[], retriedIds: ReadonlySet<string>) => {
  const failedDue = cards.filter((card) => retriedIds.has(card.id)).length;
  return { failedDue, reviewRemaining: cards.length - failedDue, newRemaining: 0 };
};

export default batchQueueCounts;
