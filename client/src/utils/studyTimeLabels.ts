import type { StudyTimeAnalyticsBucket, StudyTimeAnalyticsRange } from '../types/studyActivity';
import { zonedDateKey } from './studyTimePeriod';

export default function bucketLabel(
  bucket: StudyTimeAnalyticsBucket,
  analytics: StudyTimeAnalyticsRange,
  locale: string,
  timeZone: string
) {
  const date = new Date(bucket.startsAt);
  const unit =
    analytics.bucketUnit ??
    ({ today: 'hour', week: 'day', month: 'day', year: 'month', all: 'year' } as const)[
      analytics.key
    ];
  const step = analytics.bucketStep ?? 1;

  if (unit === 'hour') return date.toLocaleTimeString(locale, { timeZone, hour: 'numeric' });
  if (unit === 'day' && analytics.key === 'week') {
    return date.toLocaleDateString(locale, { timeZone, weekday: 'short' });
  }
  if (unit === 'day' && analytics.key === 'month') {
    return date.toLocaleDateString(locale, { timeZone, day: 'numeric' });
  }
  if (unit === 'day' || unit === 'week') {
    return date.toLocaleDateString(locale, { timeZone, month: 'short', day: 'numeric' });
  }
  if (unit === 'month') {
    return date.toLocaleDateString(locale, {
      timeZone,
      month: 'short',
      ...(analytics.key === 'all' ? { year: '2-digit' as const } : {}),
    });
  }
  if (unit === 'quarter') {
    const month = Number(
      new Intl.DateTimeFormat('en-US', { timeZone, month: 'numeric' }).format(date)
    );
    const quarter = Math.floor((month - 1) / 3) + 1;
    const year = date.toLocaleDateString(locale, { timeZone, year: 'numeric' });
    return `Q${quarter} ${year}`;
  }
  if (step > 1) {
    const inclusiveEnd = new Date(new Date(bucket.endsAt).getTime() - 1);
    const startYear = zonedDateKey(date, timeZone).slice(0, 4);
    const endYear = zonedDateKey(inclusiveEnd, timeZone).slice(0, 4);
    return `${startYear}–${endYear}`;
  }
  return date.toLocaleDateString(locale, { timeZone, year: 'numeric' });
}
