import type { StudyTimeRange } from '../types/studyActivity';

export function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
