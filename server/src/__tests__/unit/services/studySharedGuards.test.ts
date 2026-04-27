import { describe, expect, it } from 'vitest';

import { parseOptionalStudyOverview } from '../../../services/study/shared/guards.js';

describe('study shared guards', () => {
  it('accepts current study overview payloads with optional new-card allowance fields', () => {
    expect(
      parseOptionalStudyOverview({
        dueCount: 3,
        newCount: 20,
        learningCount: 1,
        reviewCount: 2,
        suspendedCount: 0,
        totalCards: 26,
        newCardsPerDay: 20,
        newCardsIntroducedToday: 4,
        newCardsAvailableToday: 16,
        nextDueAt: '2026-04-12T00:00:00.000Z',
      })
    ).toEqual({
      dueCount: 3,
      newCount: 20,
      learningCount: 1,
      reviewCount: 2,
      suspendedCount: 0,
      totalCards: 26,
      newCardsPerDay: 20,
      newCardsIntroducedToday: 4,
      newCardsAvailableToday: 16,
      latestImport: null,
      nextDueAt: '2026-04-12T00:00:00.000Z',
    });
  });

  it('keeps old overview payloads valid when new-card allowance fields are absent', () => {
    expect(
      parseOptionalStudyOverview({
        dueCount: 3,
        newCount: 20,
        learningCount: 1,
        reviewCount: 2,
        suspendedCount: 0,
        totalCards: 26,
        nextDueAt: null,
      })
    ).toEqual({
      dueCount: 3,
      newCount: 20,
      learningCount: 1,
      reviewCount: 2,
      suspendedCount: 0,
      totalCards: 26,
      newCardsPerDay: undefined,
      newCardsIntroducedToday: undefined,
      newCardsAvailableToday: undefined,
      latestImport: null,
      nextDueAt: null,
    });
  });
});
