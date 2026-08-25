import { describe, expect, it } from 'vitest';

import {
  CROSS_MIDNIGHT_STUDY_TIME_RANGE,
  FIXED_STUDY_TIME_AXIS_FIXTURES,
  STUDY_ACTIVITY_CATEGORIES,
  studyTimeBucket,
  studyTimeRange,
} from '../../test/fixtures/studyTimeAnalytics';
import type { StudyActivityCategory } from '../../types/studyActivity';
import buildStudyTimeAnalyticsProjection, {
  type StudyTimeAnalyticsProjection,
} from '../studyTimeAnalyticsModel';

const GENERATED_AT = '2026-08-15T16:00:00.000Z';
const TIME_ZONE = 'America/New_York';

function project(
  analytics = studyTimeRange(),
  includedCategories: readonly StudyActivityCategory[] = STUDY_ACTIVITY_CATEGORIES,
  generatedAt = GENERATED_AT
) {
  return buildStudyTimeAnalyticsProjection({
    analytics,
    categories: STUDY_ACTIVITY_CATEGORIES,
    generatedAt,
    includedCategories: new Set(includedCategories),
    timeZone: TIME_ZONE,
  });
}

function expectProjectionConservation(projection: StudyTimeAnalyticsProjection) {
  const visibleCategoryTotal = projection.categories.reduce(
    (total, category) => total + (category.included ? category.totalMs : 0),
    0
  );
  expect(projection.totalMs).toBe(visibleCategoryTotal);

  projection.buckets.forEach((bucket) => {
    const stackedTotal = Object.values(bucket.categoryTotals).reduce(
      (total, value) => total + (value ?? 0),
      0
    );
    expect(bucket.totalMs).toBe(stackedTotal);
  });

  expect(projection.buckets.reduce((total, bucket) => total + bucket.totalMs, 0)).toBe(
    projection.totalMs
  );

  expect(projection.maximumBucketMs).toBe(
    Math.max(...projection.buckets.map((bucket) => bucket.totalMs), 1)
  );
}

describe('study analytics correctness matrix', () => {
  it.each(FIXED_STUDY_TIME_AXIS_FIXTURES)('$name', (fixture) => {
    const projection = project(fixture.range);

    expect(projection.buckets).toHaveLength(fixture.expectedBucketCount);
    expect(projection.buckets[0].bucket.startsAt).toBe(fixture.expectedFirstBucketStart);
    expect(projection.buckets.at(-1)?.bucket.endsAt).toBe(fixture.expectedLastBucketEnd);
    expect(projection.buckets.slice(1).every((bucket) => bucket.totalMs === 0)).toBe(true);
    expectProjectionConservation(projection);
  });

  it('preserves a backend-provided cross-midnight split without collapsing its day buckets', () => {
    const projection = project(CROSS_MIDNIGHT_STUDY_TIME_RANGE);

    expect(projection.buckets).toHaveLength(7);
    expect(projection.buckets.map((bucket) => bucket.totalMs)).toEqual([
      1_800_001, 4_801_001, 0, 0, 0, 0, 0,
    ]);
    expect(projection.totalMs).toBe(6_601_002);
    expect(projection.bestBucket?.bucket.startsAt).toBe('2026-07-28T04:00:00.000000Z');
    expectProjectionConservation(projection);
  });

  it.each([
    {
      name: 'all categories',
      included: STUDY_ACTIVITY_CATEGORIES,
      expectedTotalMs: 6_601_002,
      expectedBucketsMs: [1_800_001, 4_801_001, 0, 0, 0, 0, 0],
    },
    {
      name: 'review only',
      included: ['review'] as const,
      expectedTotalMs: 3_600_001,
      expectedBucketsMs: [1_800_001, 1_800_000, 0, 0, 0, 0, 0],
    },
    {
      name: 'listen only',
      included: ['listen'] as const,
      expectedTotalMs: 900_001,
      expectedBucketsMs: [0, 900_001, 0, 0, 0, 0, 0],
    },
    {
      name: 'conversation only',
      included: ['conversation'] as const,
      expectedTotalMs: 1_200_000,
      expectedBucketsMs: [0, 1_200_000, 0, 0, 0, 0, 0],
    },
  ])('conserves totals when filtering to $name', (fixture) => {
    const projection = project(CROSS_MIDNIGHT_STUDY_TIME_RANGE, fixture.included);

    expect(projection.totalMs).toBe(fixture.expectedTotalMs);
    expect(projection.buckets.map((bucket) => bucket.totalMs)).toEqual(fixture.expectedBucketsMs);
    expectProjectionConservation(projection);
  });

  it('keeps an entirely empty fixed axis stable', () => {
    const boundaries = Array.from({ length: 8 }, (_, day) =>
      new Date(Date.UTC(2026, 7, 10 + day, 4)).toISOString()
    );
    const analytics = studyTimeRange({
      buckets: boundaries
        .slice(0, -1)
        .map((startsAt, index) => studyTimeBucket(startsAt, boundaries[index + 1])),
    });
    const projection = project(analytics);

    expect(projection.buckets).toHaveLength(7);
    expect(projection.totalMs).toBe(0);
    expect(projection.dailyAverageMs).toBe(0);
    expect(projection.bestBucket).toBeNull();
    expect(projection.maximumBucketMs).toBe(1);
    expectProjectionConservation(projection);
  });

  it('counts local dates instead of elapsed hours across spring daylight saving time', () => {
    const analytics = studyTimeRange({
      startsAt: '2026-03-08T05:00:00.000Z',
      endsAt: '2026-03-15T04:00:00.000Z',
      buckets: [
        studyTimeBucket('2026-03-08T05:00:00.000Z', '2026-03-09T04:00:00.000Z', {
          review: 60 * 60_000,
        }),
        studyTimeBucket('2026-03-09T04:00:00.000Z', '2026-03-10T04:00:00.000Z', {
          review: 60 * 60_000,
        }),
      ],
    });
    const projection = project(analytics, ['review'], '2026-03-09T16:00:00.000Z');

    expect(projection.totalMs).toBe(120 * 60_000);
    expect(projection.dailyAverageMs).toBe(60 * 60_000);
    expectProjectionConservation(projection);
  });
});
