import { describe, it, expect } from 'vitest';

import {
  getWeekStart,
  getNextWeekStart,
  getMonthStart,
  getNextMonthStart,
} from '../../../utils/dateUtils.js';

describe('Date Utils - Week Boundary Handling', () => {
  describe('getWeekStart', () => {
    it('should return Monday 00:00:00 UTC for Monday input', () => {
      // Monday January 6, 2025 at 00:00:00 UTC
      const monday = new Date('2025-01-06T00:00:00Z');
      const weekStart = getWeekStart(monday);

      expect(weekStart.toISOString()).toBe('2025-01-06T00:00:00.000Z');
      expect(weekStart.getUTCDay()).toBe(1); // Monday
      expect(weekStart.getUTCHours()).toBe(0);
      expect(weekStart.getUTCMinutes()).toBe(0);
      expect(weekStart.getUTCSeconds()).toBe(0);
    });

    it('should return Monday 00:00:00 UTC for Sunday input', () => {
      // Sunday January 5, 2025 at 23:59:59 UTC
      const sunday = new Date('2025-01-05T23:59:59Z');
      const weekStart = getWeekStart(sunday);

      // Should return Monday December 30, 2024 (start of week containing this Sunday)
      expect(weekStart.toISOString()).toBe('2024-12-30T00:00:00.000Z');
      expect(weekStart.getUTCDay()).toBe(1); // Monday
      expect(weekStart.getUTCHours()).toBe(0);
    });

    it('should return Monday 00:00:00 UTC for Tuesday input', () => {
      // Tuesday January 7, 2025 at 15:30:00 UTC
      const tuesday = new Date('2025-01-07T15:30:00Z');
      const weekStart = getWeekStart(tuesday);

      expect(weekStart.toISOString()).toBe('2025-01-06T00:00:00.000Z');
      expect(weekStart.getUTCDay()).toBe(1); // Monday
    });

    it('should return Monday 00:00:00 UTC for Wednesday input', () => {
      const wednesday = new Date('2025-01-08T12:00:00Z');
      const weekStart = getWeekStart(wednesday);

      expect(weekStart.toISOString()).toBe('2025-01-06T00:00:00.000Z');
      expect(weekStart.getUTCDay()).toBe(1);
    });

    it('should return Monday 00:00:00 UTC for Thursday input', () => {
      const thursday = new Date('2025-01-09T12:00:00Z');
      const weekStart = getWeekStart(thursday);

      expect(weekStart.toISOString()).toBe('2025-01-06T00:00:00.000Z');
      expect(weekStart.getUTCDay()).toBe(1);
    });

    it('should return Monday 00:00:00 UTC for Friday input', () => {
      const friday = new Date('2025-01-10T12:00:00Z');
      const weekStart = getWeekStart(friday);

      expect(weekStart.toISOString()).toBe('2025-01-06T00:00:00.000Z');
      expect(weekStart.getUTCDay()).toBe(1);
    });

    it('should return Monday 00:00:00 UTC for Saturday input', () => {
      const saturday = new Date('2025-01-11T12:00:00Z');
      const weekStart = getWeekStart(saturday);

      expect(weekStart.toISOString()).toBe('2025-01-06T00:00:00.000Z');
      expect(weekStart.getUTCDay()).toBe(1);
    });

    it('should handle end of week (Sunday 23:59:59) correctly', () => {
      const endOfWeek = new Date('2025-01-05T23:59:59.999Z'); // Sunday
      const weekStart = getWeekStart(endOfWeek);

      expect(weekStart.toISOString()).toBe('2024-12-30T00:00:00.000Z');
      expect(weekStart.getUTCDay()).toBe(1);
    });

    it('should handle start of week (Monday 00:00:00) correctly', () => {
      const startOfWeek = new Date('2025-01-06T00:00:00.000Z'); // Monday
      const weekStart = getWeekStart(startOfWeek);

      expect(weekStart.toISOString()).toBe('2025-01-06T00:00:00.000Z');
      expect(weekStart.getUTCDay()).toBe(1);
    });

    it('should maintain UTC timezone regardless of system timezone', () => {
      // Even if system is in PST (UTC-8), should return Monday UTC
      const date = new Date('2025-01-08T08:00:00Z'); // Wednesday 8am UTC
      const weekStart = getWeekStart(date);

      // Should be Monday of same week in UTC
      expect(weekStart.getUTCDay()).toBe(1);
      expect(weekStart.getUTCHours()).toBe(0);
      expect(weekStart.toISOString()).toBe('2025-01-06T00:00:00.000Z');
    });

    it('should use current date when no argument provided', () => {
      const weekStart = getWeekStart();

      expect(weekStart.getUTCDay()).toBe(1); // Always Monday
      expect(weekStart.getUTCHours()).toBe(0);
      expect(weekStart.getUTCMinutes()).toBe(0);
      expect(weekStart.getUTCSeconds()).toBe(0);
    });
  });

  describe('getNextWeekStart', () => {
    it('should return next Monday from current Monday', () => {
      const monday = new Date('2025-01-06T00:00:00Z');
      const nextWeekStart = getNextWeekStart(monday);

      expect(nextWeekStart.toISOString()).toBe('2025-01-13T00:00:00.000Z');
      expect(nextWeekStart.getUTCDay()).toBe(1); // Monday
    });

    it('should return next Monday from Sunday', () => {
      const sunday = new Date('2025-01-05T23:59:59Z');
      const nextWeekStart = getNextWeekStart(sunday);

      // Current week starts Dec 30, next week is Jan 6
      expect(nextWeekStart.toISOString()).toBe('2025-01-06T00:00:00.000Z');
      expect(nextWeekStart.getUTCDay()).toBe(1);
    });

    it('should return next Monday from mid-week (Wednesday)', () => {
      const wednesday = new Date('2025-01-08T12:00:00Z');
      const nextWeekStart = getNextWeekStart(wednesday);

      // Current week: Jan 6, next week: Jan 13
      expect(nextWeekStart.toISOString()).toBe('2025-01-13T00:00:00.000Z');
      expect(nextWeekStart.getUTCDay()).toBe(1);
    });

    it('should always be exactly 7 days after current week start', () => {
      const dates = [
        new Date('2025-01-06T00:00:00Z'), // Monday
        new Date('2025-01-07T00:00:00Z'), // Tuesday
        new Date('2025-01-08T00:00:00Z'), // Wednesday
        new Date('2025-01-09T00:00:00Z'), // Thursday
        new Date('2025-01-10T00:00:00Z'), // Friday
        new Date('2025-01-11T00:00:00Z'), // Saturday
        new Date('2025-01-12T00:00:00Z'), // Sunday
      ];

      dates.forEach((date) => {
        const weekStart = getWeekStart(date);
        const nextWeekStart = getNextWeekStart(date);

        const diffMs = nextWeekStart.getTime() - weekStart.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        expect(diffDays).toBe(7);
      });
    });

    it('should use current date when no argument provided', () => {
      const nextWeekStart = getNextWeekStart();

      expect(nextWeekStart.getUTCDay()).toBe(1); // Always Monday
      expect(nextWeekStart.getUTCHours()).toBe(0);
      expect(nextWeekStart.getUTCMinutes()).toBe(0);
      expect(nextWeekStart.getUTCSeconds()).toBe(0);
    });
  });

  describe('Daylight Saving Time (DST) Handling', () => {
    it('should handle DST transition in March (spring forward)', () => {
      // In 2025, DST starts March 9 (in US)
      // But UTC time is unaffected
      const beforeDST = new Date('2025-03-08T12:00:00Z'); // Saturday before DST
      const afterDST = new Date('2025-03-10T12:00:00Z'); // Monday after DST

      const weekStartBefore = getWeekStart(beforeDST);
      const weekStartAfter = getWeekStart(afterDST);

      // Both should return Monday 00:00:00 UTC
      expect(weekStartBefore.getUTCHours()).toBe(0);
      expect(weekStartAfter.getUTCHours()).toBe(0);

      // Week boundaries should be consistent
      expect(weekStartBefore.getUTCDay()).toBe(1);
      expect(weekStartAfter.getUTCDay()).toBe(1);
    });

    it('should handle DST transition in November (fall back)', () => {
      // In 2025, DST ends November 2 (in US)
      const beforeDST = new Date('2025-11-01T12:00:00Z');
      const afterDST = new Date('2025-11-03T12:00:00Z');

      const weekStartBefore = getWeekStart(beforeDST);
      const weekStartAfter = getWeekStart(afterDST);

      // UTC is not affected by DST
      expect(weekStartBefore.getUTCHours()).toBe(0);
      expect(weekStartAfter.getUTCHours()).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle year boundary (Dec 31 to Jan 1)', () => {
      // Monday Dec 30, 2024 starts a week that spans into 2025
      const dec31 = new Date('2024-12-31T12:00:00Z'); // Tuesday
      const jan1 = new Date('2025-01-01T12:00:00Z'); // Wednesday

      const weekStartDec = getWeekStart(dec31);
      const weekStartJan = getWeekStart(jan1);

      // Both in same week starting Monday Dec 30
      expect(weekStartDec.toISOString()).toBe('2024-12-30T00:00:00.000Z');
      expect(weekStartJan.toISOString()).toBe('2024-12-30T00:00:00.000Z');
    });

    it('should handle leap year (Feb 29)', () => {
      // 2024 was a leap year
      const leapDay = new Date('2024-02-29T12:00:00Z'); // Thursday
      const weekStart = getWeekStart(leapDay);

      expect(weekStart.getUTCDay()).toBe(1); // Monday
      expect(weekStart.toISOString()).toBe('2024-02-26T00:00:00.000Z');
    });

    it('should handle milliseconds precision', () => {
      const dateWithMs = new Date('2025-01-08T12:34:56.789Z');
      const weekStart = getWeekStart(dateWithMs);

      // Should truncate to 00:00:00.000
      expect(weekStart.getUTCMilliseconds()).toBe(0);
      expect(weekStart.toISOString()).toBe('2025-01-06T00:00:00.000Z');
    });

    it('should be deterministic (same input always returns same output)', () => {
      const date = new Date('2025-01-08T12:00:00Z');

      const result1 = getWeekStart(date);
      const result2 = getWeekStart(date);
      const result3 = getWeekStart(date);

      expect(result1.toISOString()).toBe(result2.toISOString());
      expect(result2.toISOString()).toBe(result3.toISOString());
    });
  });
});

describe('Date Utils - Month Boundary Handling', () => {
  describe('getMonthStart', () => {
    it('should return 1st of month at 00:00:00 UTC for 1st day input', () => {
      const firstDay = new Date('2026-01-01T00:00:00Z');
      const monthStart = getMonthStart(firstDay);

      expect(monthStart.toISOString()).toBe('2026-01-01T00:00:00.000Z');
      expect(monthStart.getUTCDate()).toBe(1);
      expect(monthStart.getUTCHours()).toBe(0);
      expect(monthStart.getUTCMinutes()).toBe(0);
      expect(monthStart.getUTCSeconds()).toBe(0);
    });

    it('should return 1st of month for mid-month date', () => {
      const midMonth = new Date('2026-01-15T15:30:00Z');
      const monthStart = getMonthStart(midMonth);

      expect(monthStart.toISOString()).toBe('2026-01-01T00:00:00.000Z');
      expect(monthStart.getUTCDate()).toBe(1);
    });

    it('should return 1st of month for last day of month', () => {
      const lastDay = new Date('2026-01-31T23:59:59Z');
      const monthStart = getMonthStart(lastDay);

      expect(monthStart.toISOString()).toBe('2026-01-01T00:00:00.000Z');
      expect(monthStart.getUTCDate()).toBe(1);
    });

    it('should handle February (non-leap year)', () => {
      const feb28 = new Date('2026-02-28T12:00:00Z');
      const monthStart = getMonthStart(feb28);

      expect(monthStart.toISOString()).toBe('2026-02-01T00:00:00.000Z');
      expect(monthStart.getUTCDate()).toBe(1);
      expect(monthStart.getUTCMonth()).toBe(1); // February (0-indexed)
    });

    it('should handle leap year February', () => {
      const feb29 = new Date('2024-02-29T12:00:00Z'); // 2024 was a leap year
      const monthStart = getMonthStart(feb29);

      expect(monthStart.toISOString()).toBe('2024-02-01T00:00:00.000Z');
      expect(monthStart.getUTCDate()).toBe(1);
    });

    it('should handle year boundary (December to January)', () => {
      const dec31 = new Date('2025-12-31T23:59:59Z');
      const monthStart = getMonthStart(dec31);

      expect(monthStart.toISOString()).toBe('2025-12-01T00:00:00.000Z');
      expect(monthStart.getUTCMonth()).toBe(11); // December (0-indexed)
    });

    it('should use current date when no argument provided', () => {
      const monthStart = getMonthStart();

      expect(monthStart.getUTCDate()).toBe(1); // Always 1st of month
      expect(monthStart.getUTCHours()).toBe(0);
      expect(monthStart.getUTCMinutes()).toBe(0);
      expect(monthStart.getUTCSeconds()).toBe(0);
    });
  });

  describe('getNextMonthStart', () => {
    it('should return 1st of next month from current month start', () => {
      const jan1 = new Date('2026-01-01T00:00:00Z');
      const nextMonthStart = getNextMonthStart(jan1);

      expect(nextMonthStart.toISOString()).toBe('2026-02-01T00:00:00.000Z');
      expect(nextMonthStart.getUTCDate()).toBe(1);
      expect(nextMonthStart.getUTCMonth()).toBe(1); // February
    });

    it('should return 1st of next month from mid-month', () => {
      const jan15 = new Date('2026-01-15T12:00:00Z');
      const nextMonthStart = getNextMonthStart(jan15);

      expect(nextMonthStart.toISOString()).toBe('2026-02-01T00:00:00.000Z');
      expect(nextMonthStart.getUTCDate()).toBe(1);
    });

    it('should return 1st of next month from end of month', () => {
      const jan31 = new Date('2026-01-31T23:59:59Z');
      const nextMonthStart = getNextMonthStart(jan31);

      expect(nextMonthStart.toISOString()).toBe('2026-02-01T00:00:00.000Z');
      expect(nextMonthStart.getUTCDate()).toBe(1);
    });

    it('should handle year boundary (December to January)', () => {
      const dec15 = new Date('2025-12-15T12:00:00Z');
      const nextMonthStart = getNextMonthStart(dec15);

      expect(nextMonthStart.toISOString()).toBe('2026-01-01T00:00:00.000Z');
      expect(nextMonthStart.getUTCDate()).toBe(1);
      expect(nextMonthStart.getUTCMonth()).toBe(0); // January
      expect(nextMonthStart.getUTCFullYear()).toBe(2026);
    });

    it('should handle transition from 31-day month to 28-day month', () => {
      const jan31 = new Date('2026-01-31T12:00:00Z');
      const nextMonthStart = getNextMonthStart(jan31);

      expect(nextMonthStart.toISOString()).toBe('2026-02-01T00:00:00.000Z');
      expect(nextMonthStart.getUTCDate()).toBe(1);
      expect(nextMonthStart.getUTCMonth()).toBe(1); // February
    });

    it('should handle leap year transition', () => {
      const jan15_2024 = new Date('2024-01-15T12:00:00Z');
      const nextMonthStart = getNextMonthStart(jan15_2024);

      expect(nextMonthStart.toISOString()).toBe('2024-02-01T00:00:00.000Z');
      expect(nextMonthStart.getUTCDate()).toBe(1);
    });

    it('should use current date when no argument provided', () => {
      const nextMonthStart = getNextMonthStart();

      expect(nextMonthStart.getUTCDate()).toBe(1); // Always 1st of month
      expect(nextMonthStart.getUTCHours()).toBe(0);
      expect(nextMonthStart.getUTCMinutes()).toBe(0);
      expect(nextMonthStart.getUTCSeconds()).toBe(0);
    });
  });

  describe('Month Edge Cases', () => {
    it('should handle all 12 months correctly', () => {
      const months = [
        { date: '2026-01-15T12:00:00Z', expected: '2026-01-01T00:00:00.000Z' },
        { date: '2026-02-15T12:00:00Z', expected: '2026-02-01T00:00:00.000Z' },
        { date: '2026-03-15T12:00:00Z', expected: '2026-03-01T00:00:00.000Z' },
        { date: '2026-04-15T12:00:00Z', expected: '2026-04-01T00:00:00.000Z' },
        { date: '2026-05-15T12:00:00Z', expected: '2026-05-01T00:00:00.000Z' },
        { date: '2026-06-15T12:00:00Z', expected: '2026-06-01T00:00:00.000Z' },
        { date: '2026-07-15T12:00:00Z', expected: '2026-07-01T00:00:00.000Z' },
        { date: '2026-08-15T12:00:00Z', expected: '2026-08-01T00:00:00.000Z' },
        { date: '2026-09-15T12:00:00Z', expected: '2026-09-01T00:00:00.000Z' },
        { date: '2026-10-15T12:00:00Z', expected: '2026-10-01T00:00:00.000Z' },
        { date: '2026-11-15T12:00:00Z', expected: '2026-11-01T00:00:00.000Z' },
        { date: '2026-12-15T12:00:00Z', expected: '2026-12-01T00:00:00.000Z' },
      ];

      months.forEach(({ date, expected }) => {
        const monthStart = getMonthStart(new Date(date));
        expect(monthStart.toISOString()).toBe(expected);
      });
    });

    it('should be deterministic (same input always returns same output)', () => {
      const date = new Date('2026-01-15T12:00:00Z');

      const result1 = getMonthStart(date);
      const result2 = getMonthStart(date);
      const result3 = getMonthStart(date);

      expect(result1.toISOString()).toBe(result2.toISOString());
      expect(result2.toISOString()).toBe(result3.toISOString());
    });

    it('should handle milliseconds precision', () => {
      const dateWithMs = new Date('2026-01-15T12:34:56.789Z');
      const monthStart = getMonthStart(dateWithMs);

      // Should truncate to 00:00:00.000
      expect(monthStart.getUTCMilliseconds()).toBe(0);
      expect(monthStart.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    });
  });
});
