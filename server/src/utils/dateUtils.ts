/**
 * Date utility functions for rate limiting and quota management
 */

/**
 * Get the start of the current week (Monday at 00:00:00 UTC)
 * @param date - Optional date to calculate week start from (defaults to now)
 * @returns Date object representing the start of the week
 */
export function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);

  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // Adjust to Monday (0 = Sunday, 1 = Monday)
  d.setUTCDate(d.getUTCDate() + diff);

  return d;
}

/**
 * Get the next week start (for "resets at" messaging)
 * @param date - Optional date to calculate next week from (defaults to now)
 * @returns Date object representing the start of next week
 */
export function getNextWeekStart(date: Date = new Date()): Date {
  const weekStart = getWeekStart(date);
  weekStart.setUTCDate(weekStart.getUTCDate() + 7);
  return weekStart;
}

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
