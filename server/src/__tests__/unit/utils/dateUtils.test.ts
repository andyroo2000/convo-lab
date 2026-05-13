import { describe, it, expect } from 'vitest';

import { getMonthStart, getNextMonthStart } from '../../../utils/dateUtils.js';

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
