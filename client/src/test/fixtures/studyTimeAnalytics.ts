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

export interface FixedStudyTimeAxisFixture {
  expectedBucketCount: number;
  expectedFirstBucketStart: string;
  expectedLastBucketEnd: string;
  name: string;
  range: StudyTimeAnalyticsRange;
}

function emptyBuckets(
  boundaries: readonly string[],
  firstBucketCategories: Partial<Record<StudyActivityCategory, number>> = {}
) {
  return boundaries
    .slice(0, -1)
    .map((startsAt, index) =>
      studyTimeBucket(startsAt, boundaries[index + 1], index === 0 ? firstBucketCategories : {})
    );
}

function hourlyBoundaries(startsAt: string, hours: number) {
  const start = new Date(startsAt).getTime();
  return Array.from({ length: hours + 1 }, (_, index) =>
    new Date(start + index * 60 * 60_000).toISOString()
  );
}

function dailyBoundaries(startsAt: string, days: number) {
  const start = new Date(startsAt).getTime();
  return Array.from({ length: days + 1 }, (_, index) =>
    new Date(start + index * 24 * 60 * 60_000).toISOString()
  );
}

export const FIXED_STUDY_TIME_AXIS_FIXTURES: readonly FixedStudyTimeAxisFixture[] = [
  {
    name: 'today keeps all 24 hourly buckets',
    expectedBucketCount: 24,
    expectedFirstBucketStart: '2026-08-15T04:00:00.000Z',
    expectedLastBucketEnd: '2026-08-16T04:00:00.000Z',
    range: studyTimeRange({
      key: 'today',
      startsAt: '2026-08-15T04:00:00.000Z',
      endsAt: '2026-08-16T04:00:00.000Z',
      buckets: emptyBuckets(hourlyBoundaries('2026-08-15T04:00:00.000Z', 24), {
        review: 30 * 60_000,
      }),
    }),
  },
  {
    name: 'week keeps all seven daily buckets',
    expectedBucketCount: 7,
    expectedFirstBucketStart: '2026-08-10T04:00:00.000Z',
    expectedLastBucketEnd: '2026-08-17T04:00:00.000Z',
    range: studyTimeRange({
      key: 'week',
      startsAt: '2026-08-10T04:00:00.000Z',
      endsAt: '2026-08-17T04:00:00.000Z',
      buckets: emptyBuckets(dailyBoundaries('2026-08-10T04:00:00.000Z', 7), {
        review: 30 * 60_000,
      }),
    }),
  },
  {
    name: 'month keeps all 31 daily buckets',
    expectedBucketCount: 31,
    expectedFirstBucketStart: '2026-08-01T04:00:00.000Z',
    expectedLastBucketEnd: '2026-09-01T04:00:00.000Z',
    range: studyTimeRange({
      key: 'month',
      startsAt: '2026-08-01T04:00:00.000Z',
      endsAt: '2026-09-01T04:00:00.000Z',
      buckets: emptyBuckets(dailyBoundaries('2026-08-01T04:00:00.000Z', 31), {
        review: 30 * 60_000,
      }),
    }),
  },
  {
    name: 'year keeps all 12 monthly buckets',
    expectedBucketCount: 12,
    expectedFirstBucketStart: '2026-01-01T05:00:00.000Z',
    expectedLastBucketEnd: '2027-01-01T05:00:00.000Z',
    range: studyTimeRange({
      key: 'year',
      startsAt: '2026-01-01T05:00:00.000Z',
      endsAt: '2027-01-01T05:00:00.000Z',
      buckets: emptyBuckets(
        Array.from({ length: 13 }, (_, month) =>
          new Date(Date.UTC(2026, month, 1, 5)).toISOString()
        ),
        { review: 30 * 60_000 }
      ),
    }),
  },
];

export const CROSS_MIDNIGHT_STUDY_TIME_RANGE = studyTimeRange({
  key: 'week',
  startsAt: '2026-08-10T04:00:00.000Z',
  endsAt: '2026-08-17T04:00:00.000Z',
  buckets: [
    studyTimeBucket('2026-08-10T04:00:00.000Z', '2026-08-11T04:00:00.000Z'),
    studyTimeBucket('2026-08-11T04:00:00.000Z', '2026-08-12T04:00:00.000Z', {
      review: 20 * 60_000,
      listen: 10 * 60_000,
    }),
    studyTimeBucket('2026-08-12T04:00:00.000Z', '2026-08-13T04:00:00.000Z', {
      review: 40 * 60_000,
      listen: 20 * 60_000,
    }),
    ...emptyBuckets(dailyBoundaries('2026-08-13T04:00:00.000Z', 4)),
  ],
});
