import { describe, it, expect } from 'vitest';
import { getWeekStart, getNextWeekStart } from '../../../utils/dateUtils.js';

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
