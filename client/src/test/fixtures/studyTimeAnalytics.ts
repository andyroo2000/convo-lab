import type {
  StudyActivityCategory,
  StudyTimeAnalyticsBucket,
  StudyTimeAnalyticsRange,
} from '../../types/studyActivity';

export const STUDY_ACTIVITY_CATEGORIES: readonly StudyActivityCategory[] = [
  'review',
  'listen',
  'create',
  'immerse',
  'conversation',
  'wanikani',
];

export function studyCategoryTotals(
  values: Partial<Record<StudyActivityCategory, number>> = {}
): Record<StudyActivityCategory, number> {
  return {
    review: 0,
    listen: 0,
    create: 0,
    immerse: 0,
    conversation: 0,
    wanikani: 0,
    ...values,
  };
}

export function studyTimeBucket(
  startsAt: string,
  endsAt: string,
  categories: Partial<Record<StudyActivityCategory, number>> = {}
): StudyTimeAnalyticsBucket {
  const totals = studyCategoryTotals(categories);
  return {
    startsAt,
    endsAt,
    categories: totals,
    totalMs: Object.values(totals).reduce((sum, value) => sum + value, 0),
  };
}

export function studyTimeRange(
  overrides: Partial<StudyTimeAnalyticsRange> = {}
): StudyTimeAnalyticsRange {
  const buckets = overrides.buckets ?? [
    studyTimeBucket('2026-08-10T04:00:00.000Z', '2026-08-11T04:00:00.000Z', {
      review: 30 * 60_000,
      listen: 15 * 60_000,
    }),
    studyTimeBucket('2026-08-11T04:00:00.000Z', '2026-08-12T04:00:00.000Z', {
      review: 10 * 60_000,
      conversation: 60 * 60_000,
    }),
  ];
  const categories = studyCategoryTotals();
  buckets.forEach((bucket) => {
    STUDY_ACTIVITY_CATEGORIES.forEach((category) => {
      categories[category] += bucket.categories[category] ?? 0;
    });
  });

  return {
    key: 'week',
    startsAt: '2026-08-10T04:00:00.000Z',
    endsAt: '2026-08-17T04:00:00.000Z',
    totalMs: Object.values(categories).reduce((sum, value) => sum + value, 0),
    categories,
    buckets,
    ...overrides,
  };
}
