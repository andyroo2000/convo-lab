import type { StudyCardSummary } from '@languageflow/shared/src/types';
import { describe, expect, it } from 'vitest';

import {
  calculateStudySessionProgress,
  deriveStudySessionCounts,
} from '../useStudyReviewSessionDerivedState';

const makeCard = (
  id: string,
  queueState: 'new' | 'learning' | 'review',
  failedAt: string | null = null
) =>
  ({
    id,
    state: { failedAt, queueState },
  }) as StudyCardSummary;

describe('deriveStudySessionCounts', () => {
  it('separates unanswered new, review, and failed cards', () => {
    const cards = [
      makeCard('new', 'new'),
      makeCard('review', 'review'),
      makeCard('answered', 'learning'),
      makeCard('failed', 'review', '2026-09-02T12:00:00Z'),
    ];

    expect(deriveStudySessionCounts(cards, ['answered'], 0)).toEqual({
      failedDue: 1,
      newRemaining: 1,
      reviewRemaining: 1,
    });
  });

  it('keeps the larger failed count reported by the overview', () => {
    const cards = [makeCard('failed', 'review', '2026-09-02T12:00:00Z')];

    expect(deriveStudySessionCounts(cards, [], 3).failedDue).toBe(3);
  });
});

describe('calculateStudySessionProgress', () => {
  it('tracks practice completion from the initial practice queue', () => {
    expect(
      calculateStudySessionProgress({
        answeredCount: 0,
        cardCount: 10,
        remainingCardCount: 3,
        practiceComplete: false,
        practiceInitialCount: 4,
        practiceMode: true,
      })
    ).toBe(0.25);
  });

  it('caps an active review session below complete', () => {
    expect(
      calculateStudySessionProgress({
        answeredCount: 10,
        cardCount: 10,
        remainingCardCount: 1,
        practiceComplete: false,
        practiceInitialCount: 0,
        practiceMode: false,
      })
    ).toBe(0.99);
  });

  it('marks an emptied review queue complete', () => {
    expect(
      calculateStudySessionProgress({
        answeredCount: 10,
        cardCount: 10,
        remainingCardCount: 0,
        practiceComplete: false,
        practiceInitialCount: 0,
        practiceMode: false,
      })
    ).toBe(1);
  });
});
