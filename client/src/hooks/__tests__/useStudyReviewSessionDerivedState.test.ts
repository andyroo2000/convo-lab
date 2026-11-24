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

  it('counts unloaded reviews and delayed failures without counting a retry twice', () => {
    const cards = [
      makeCard('due', 'review'),
      makeCard('retry', 'learning', '2026-09-02T12:00:00Z'),
    ];
    expect(deriveStudySessionCounts(cards, ['retry'], 6, 470)).toEqual({
      failedDue: 6,
      newRemaining: 0,
      reviewRemaining: 470,
    });
    expect(deriveStudySessionCounts([cards[0]], [], 0, 0).reviewRemaining).toBe(1);
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
  const counts = { failedDue: 2, reviewRemaining: 10, newRemaining: 0 };
  const options = {
    sessionReviewRecords: [],
    session,
    answeredCardIds: ['done', 'done', 'again'],
    practiceCards: null,
    sessionCardCount: 1,
    sessionKind: 'reviews' as const,
    practiceInitialCount: 0,
  };
  it('includes due cards beyond the loaded batch and counts each finished card once', () => {
    expect(calculateStudySessionProgress(options, counts)).toEqual({ completed: 1, total: 13 });
  });
  it('keeps a delayed retry outstanding until a later passing grade', () => {
    const failed = makeCard('again', 'learning', '2026-09-02T12:00:00Z');
    const record = {
      id: 'attempt1',
      cardBefore: failed,
      cardAfter: failed,
      grade: 'again' as const,
      durationMs: 200,
    };
    const waiting = {
      ...options,
      session: { ...options.session!, cards: [] },
      sessionReviewRecords: [record],
    };
    expect(
      calculateStudySessionProgress(waiting, { failedDue: 1, reviewRemaining: 0, newRemaining: 0 })
    ).toEqual({ completed: 1, total: 2 });
    const passed = {
      ...waiting,
      sessionReviewRecords: [record, { ...record, id: 'attempt2', grade: 'good' as const }],
    };
    expect(
      calculateStudySessionProgress(passed, { failedDue: 0, reviewRemaining: 0, newRemaining: 0 })
    ).toEqual({ completed: 2, total: 2 });
  });
  it('uses the current lesson or practice queue size for those modes', () => {
    expect(
      calculateStudySessionProgress(
        { ...options, sessionKind: 'lessons', sessionCardCount: 4 },
        counts
      )
    ).toEqual({ completed: 3, total: 4 });
    expect(
      calculateStudySessionProgress(
        { ...options, practiceInitialCount: 2, practiceCards: [] },
        counts
      )
    ).toEqual({ completed: 2, total: 2 });
  });
  it('starts at zero while there is no session', () => {
    expect(
      calculateStudySessionProgress(
        { ...options, session: null, answeredCardIds: [] },
        { failedDue: 0, reviewRemaining: 0, newRemaining: 0 }
      )
    ).toEqual({ completed: 0, total: 0 });
  });
});
