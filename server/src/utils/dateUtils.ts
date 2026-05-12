/**
 * Date utility functions for rate limiting and quota management
 */

/**
 * Get the start of the current month (1st day at 00:00:00 UTC)
 * @param date - Optional date to calculate month start from (defaults to now)
 * @returns Date object representing the start of the month
 */
export function getMonthStart(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the next month start (for "resets at" messaging)
 * @param date - Optional date to calculate next month from (defaults to now)
 * @returns Date object representing the start of next month
 */
export function getNextMonthStart(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}
