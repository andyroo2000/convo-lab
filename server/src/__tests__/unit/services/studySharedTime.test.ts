import { describe, expect, it } from 'vitest';

import { dateFromDayBoundary } from '../../../services/study/shared/time.js';

describe('study shared time helpers', () => {
  it('computes tomorrow at local 09:00 in the supplied timezone', () => {
    const reference = new Date('2026-01-15T12:00:00.000Z');

    expect(dateFromDayBoundary(1, 'America/Los_Angeles', reference).toISOString()).toBe(
      '2026-01-16T17:00:00.000Z'
    );
    expect(dateFromDayBoundary(1, 'Asia/Tokyo', reference).toISOString()).toBe(
      '2026-01-16T00:00:00.000Z'
    );
  });
});
