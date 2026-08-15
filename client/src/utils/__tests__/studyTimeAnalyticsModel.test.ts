import { describe, expect, it } from 'vitest';

import {
  STUDY_ACTIVITY_CATEGORIES,
  studyTimeBucket,
  studyTimeRange,
} from '../../test/fixtures/studyTimeAnalytics';
import buildStudyTimeAnalyticsProjection from '../studyTimeAnalyticsModel';

const GENERATED_AT = '2026-08-12T16:00:00.000Z';
const TIME_ZONE = 'America/New_York';

function project(
  includedCategories = new Set(STUDY_ACTIVITY_CATEGORIES),
  analytics = studyTimeRange()
) {
  return buildStudyTimeAnalyticsProjection({
    analytics,
    categories: STUDY_ACTIVITY_CATEGORIES,
    generatedAt: GENERATED_AT,
    includedCategories,
    timeZone: TIME_ZONE,
  });
}

describe('buildStudyTimeAnalyticsProjection', () => {
  it('projects totals, bucket stacks, and the best visible bucket', () => {
    const projection = project(new Set(['review', 'conversation'] as const));

    expect(projection.totalMs).toBe(100 * 60_000);
    expect(projection.buckets.map((bucket) => bucket.totalMs)).toEqual([30 * 60_000, 70 * 60_000]);
    expect(projection.buckets[0].categoryTotals).toEqual({
      review: 30 * 60_000,
      conversation: 0,
    });
    expect(projection.bestBucket?.bucket.startsAt).toBe('2026-08-11T04:00:00.000Z');
    expect(projection.bestBucket?.totalMs).toBe(70 * 60_000);
    expect(projection.maximumBucketMs).toBe(70 * 60_000);
  });

  it('keeps category totals while marking which categories are visible', () => {
    const projection = project(new Set(['listen'] as const));

    expect(projection.categories).toEqual([
      { category: 'review', included: false, totalMs: 40 * 60_000 },
      { category: 'listen', included: true, totalMs: 15 * 60_000 },
      { category: 'create', included: false, totalMs: 0 },
      { category: 'immerse', included: false, totalMs: 0 },
      { category: 'conversation', included: false, totalMs: 60 * 60_000 },
      { category: 'wanikani', included: false, totalMs: 0 },
    ]);
    expect(projection.totalMs).toBe(15 * 60_000);
  });

  it('uses elapsed calendar days for the current-period daily average', () => {
    const projection = project(new Set(['review'] as const));

    expect(projection.dailyAverageMs).toBe(Math.round((40 * 60_000) / 3));
  });

  it('uses the full historical period after its end', () => {
    const analytics = studyTimeRange({
      startsAt: '2026-08-03T04:00:00.000Z',
      endsAt: '2026-08-10T04:00:00.000Z',
      buckets: [
        studyTimeBucket('2026-08-03T04:00:00.000Z', '2026-08-10T04:00:00.000Z', {
          review: 70 * 60_000,
        }),
      ],
    });

    expect(project(new Set(['review'] as const), analytics).dailyAverageMs).toBe(10 * 60_000);
  });

  it('uses stable empty-state values when no visible bucket has time', () => {
    const projection = project(new Set(['create'] as const));

    expect(projection.totalMs).toBe(0);
    expect(projection.bestBucket).toBeNull();
    expect(projection.maximumBucketMs).toBe(1);
    expect(projection.dailyAverageMs).toBe(0);
  });

  it('keeps the first bucket when multiple buckets tie for best', () => {
    const analytics = studyTimeRange({
      buckets: [
        studyTimeBucket('2026-08-10T04:00:00.000Z', '2026-08-11T04:00:00.000Z', {
          review: 30 * 60_000,
        }),
        studyTimeBucket('2026-08-11T04:00:00.000Z', '2026-08-12T04:00:00.000Z', {
          review: 30 * 60_000,
        }),
      ],
    });

    expect(project(new Set(['review'] as const), analytics).bestBucket?.bucket.startsAt).toBe(
      '2026-08-10T04:00:00.000Z'
    );
  });
});
