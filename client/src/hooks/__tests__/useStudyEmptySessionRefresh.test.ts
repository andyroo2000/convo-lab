import type { StudyOverview } from '@languageflow/shared/src/types';
import { describe, expect, it } from 'vitest';

import { planStudyEmptySessionRefresh } from '../useStudyEmptySessionRefresh';

const makeOverview = (overrides: Partial<StudyOverview> = {}) =>
  ({
    dueCount: 0,
    failedCount: 0,
    ...overrides,
  }) as StudyOverview;

describe('planStudyEmptySessionRefresh', () => {
  const now = Date.parse('2026-09-02T12:00:00.000Z');

  it('refreshes immediately when review cards are due', () => {
    expect(planStudyEmptySessionRefresh(makeOverview({ dueCount: 1 }), now)).toEqual({
      kind: 'now',
    });
  });

  it('refreshes immediately when a failed card retry is due', () => {
    expect(
      planStudyEmptySessionRefresh(
        makeOverview({ failedCount: 1, nextDueAt: '2026-09-02T11:59:59.000Z' }),
        now
      )
    ).toEqual({ kind: 'now' });
  });

  it('waits until a future failed-card retry plus propagation padding', () => {
    expect(
      planStudyEmptySessionRefresh(
        makeOverview({ failedCount: 1, nextDueAt: '2026-09-02T12:00:10.000Z' }),
        now
      )
    ).toEqual({ kind: 'later', delayMs: 10_250 });
  });

  it('does not refresh without due or failed cards', () => {
    expect(planStudyEmptySessionRefresh(makeOverview(), now)).toBeNull();
  });

  it('does not schedule a failed-card retry without a valid due time', () => {
    expect(
      planStudyEmptySessionRefresh(makeOverview({ failedCount: 1, nextDueAt: 'not-a-date' }), now)
    ).toBeNull();
  });

  it('caps long waits at the browser timeout limit', () => {
    expect(
      planStudyEmptySessionRefresh(
        makeOverview({ failedCount: 1, nextDueAt: '2999-09-02T12:00:00.000Z' }),
        now
      )
    ).toEqual({ kind: 'later', delayMs: 2_147_483_647 });
  });
});
