import type { StudyTimeRange } from '../types/studyActivity';

const DAY_MS = 86_400_000;

function zonedCalendarDayOrdinal(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-iso8601', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date);
  const partValue = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  return Date.UTC(partValue('year'), partValue('month') - 1, partValue('day')) / DAY_MS;
}

export function calendarDayCount(
  startsAt: string | Date,
  endsAtExclusive: string | Date,
  timeZone: string
) {
  const start = new Date(startsAt);
  const end = new Date(endsAtExclusive);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    throw new RangeError('Study time period boundaries must be valid dates.');
  }
  if (end.getTime() <= start.getTime()) return 1;

  const lastIncludedInstant = new Date(end.getTime() - 1);
  return Math.max(
    1,
    zonedCalendarDayOrdinal(lastIncludedInstant, timeZone) -
      zonedCalendarDayOrdinal(start, timeZone) +
      1
  );
}

export function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function zonedDateKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-iso8601', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export default function shiftStudyTimeAnchor(
  anchorDate: string,
  range: Exclude<StudyTimeRange, 'all'>,
  amount: -1 | 1
) {
  const next = new Date(`${anchorDate}T12:00:00`);
  if (range === 'today') next.setDate(next.getDate() + amount);
  if (range === 'week') next.setDate(next.getDate() + amount * 7);
  if (range === 'month') {
    next.setDate(1);
    next.setMonth(next.getMonth() + amount);
  }
  if (range === 'year') {
    next.setMonth(0, 1);
    next.setFullYear(next.getFullYear() + amount);
  }
  return localDateKey(next);
}
