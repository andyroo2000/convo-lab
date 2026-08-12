import { describe, expect, it } from 'vitest';

import shiftStudyTimeAnchor, { calendarDayCount } from '../studyTimePeriod';

describe('shiftStudyTimeAnchor', () => {
  it('steps days and weeks by local calendar dates', () => {
    expect(shiftStudyTimeAnchor('2026-03-08', 'today', 1)).toBe('2026-03-09');
    expect(shiftStudyTimeAnchor('2026-03-08', 'week', -1)).toBe('2026-03-01');
  });

  it('normalizes month and year navigation to stable period anchors', () => {
    expect(shiftStudyTimeAnchor('2026-03-31', 'month', -1)).toBe('2026-02-01');
    expect(shiftStudyTimeAnchor('2024-02-29', 'year', 1)).toBe('2025-01-01');
  });
});

describe('calendarDayCount', () => {
  it('counts a complete fall-back day once despite its 25-hour duration', () => {
    expect(
      calendarDayCount('2026-11-01T04:00:00.000Z', '2026-11-02T05:00:00.000Z', 'America/New_York')
    ).toBe(1);
  });

  it('counts a complete spring-forward day once despite its 23-hour duration', () => {
    expect(
      calendarDayCount('2026-03-08T05:00:00.000Z', '2026-03-09T04:00:00.000Z', 'America/New_York')
    ).toBe(1);
  });
});
