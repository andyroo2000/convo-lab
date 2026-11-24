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
  const session = {
    cards: [makeCard('again', 'learning')],
    overview: { dueCount: 10, failedDueCount: 2 },
  } as Parameters<typeof calculateStudySessionProgress>[0]['session'];
  const options = {
    session,
    answeredCardIds: ['done', 'done', 'again'],
    practiceCards: null,
    sessionCardCount: 1,
    sessionKind: 'reviews' as const,
    practiceInitialCount: 0,
  };
  it('includes due cards beyond the loaded batch and counts each finished card once', () => {
    expect(calculateStudySessionProgress(options)).toEqual({ completed: 1, total: 13 });
  });
  it('uses the current lesson or practice queue size for those modes', () => {
    expect(
      calculateStudySessionProgress({ ...options, sessionKind: 'lessons', sessionCardCount: 4 })
    ).toEqual({ completed: 3, total: 4 });
    expect(
      calculateStudySessionProgress({ ...options, practiceInitialCount: 2, practiceCards: [] })
    ).toEqual({ completed: 2, total: 2 });
  });
  it('starts at zero while there is no session', () => {
    expect(
      calculateStudySessionProgress({ ...options, session: null, answeredCardIds: [] })
    ).toEqual({ completed: 0, total: 0 });
  });
});
