import type { StudyCardSummary } from '@languageflow/shared/src/types';

export type StudySessionGrade = 'again' | 'hard' | 'good' | 'easy';

export interface StudySessionReviewRecord {
  id: string;
  cardBefore: StudyCardSummary;
  cardAfter: StudyCardSummary | null;
  grade: StudySessionGrade;
  durationMs: number;
}

export interface StudySessionToughCard {
  card: StudyCardSummary;
  missCount: number;
  durationMs: number;
}

export interface StudySessionWrapUpSummary {
  reviewsCompleted: number;
  firstPassRecall: number | null;
  stabilizedCards: StudyCardSummary[];
  toughestCards: StudySessionToughCard[];
}

const cardIdentity = (card: StudyCardSummary) => card.syncId ?? card.id;

const schedulerStability = (card: StudyCardSummary | null) => card?.state.scheduler?.stability ?? 0;

interface AggregatedCard {
  card: StudyCardSummary;
  missCount: number;
  durationMs: number;
}

export function buildStudySessionWrapUp(
  records: StudySessionReviewRecord[]
): StudySessionWrapUpSummary {
  const firstAttempts = new Map<string, StudySessionReviewRecord>();
  const aggregates = new Map<string, AggregatedCard>();
  const stabilized = new Map<string, StudyCardSummary>();

  records.forEach((record) => {
    const identity = cardIdentity(record.cardBefore);
    if (!firstAttempts.has(identity)) firstAttempts.set(identity, record);

    const aggregate = aggregates.get(identity) ?? {
      card: record.cardBefore,
      missCount: 0,
      durationMs: 0,
    };
    aggregate.missCount += record.grade === 'again' ? 1 : 0;
    aggregate.durationMs = Math.max(aggregate.durationMs, record.durationMs);
    aggregates.set(identity, aggregate);

    if (
      record.cardAfter &&
      schedulerStability(record.cardBefore) < 7 &&
      schedulerStability(record.cardAfter) >= 7
    ) {
      stabilized.set(identity, record.cardAfter);
    }
  });

  const recallAttempts = [...firstAttempts.values()].filter(({ cardBefore }) =>
    ['review', 'relearning'].includes(cardBefore.state.queueState)
  );
  const recalledCount = recallAttempts.filter(({ grade }) => grade !== 'again').length;

  const aggregateValues = [...aggregates.values()];
  const byMisses = [...aggregateValues]
    .filter(({ missCount }) => missCount > 0)
    .sort((left, right) => right.missCount - left.missCount || right.durationMs - left.durationMs)
    .slice(0, 3);
  const byDuration = [...aggregateValues]
    .sort((left, right) => right.durationMs - left.durationMs || right.missCount - left.missCount)
    .slice(0, 3);
  const toughestIdentities = new Set(
    [...byMisses, ...byDuration].map(({ card }) => cardIdentity(card))
  );
  const toughestCards = aggregateValues
    .filter(({ card }) => toughestIdentities.has(cardIdentity(card)))
    .sort((left, right) => right.missCount - left.missCount || right.durationMs - left.durationMs)
    .slice(0, 6);

  return {
    reviewsCompleted: records.length,
    firstPassRecall: recallAttempts.length === 0 ? null : recalledCount / recallAttempts.length,
    stabilizedCards: [...stabilized.values()],
    toughestCards,
  };
}
