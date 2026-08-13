import { describe, expect, it } from 'vitest';

import type { StudyTimeAnalyticsBucket, StudyTimeAnalyticsRange } from '../../types/studyActivity';
import formatDuration from '../../utils/studyTimeFormat';
import bucketLabel from '../../utils/studyTimeLabels';

const emptyCategories = {
  review: 0,
  listen: 0,
  create: 0,
  immerse: 0,
  conversation: 0,
  wanikani: 0,
};

function labelFor(
  bucket: Pick<StudyTimeAnalyticsBucket, 'startsAt' | 'endsAt'>,
  bucketUnit: StudyTimeAnalyticsRange['bucketUnit'],
  bucketStep: number,
  timeZone: string
) {
  const completeBucket = { ...bucket, totalMs: 0, categories: emptyCategories };
  const analytics: StudyTimeAnalyticsRange = {
    key: 'all',
    startsAt: bucket.startsAt,
    endsAt: bucket.endsAt,
    bucketUnit,
    bucketStep,
    totalMs: 0,
    categories: emptyCategories,
    buckets: [completeBucket],
  };
  return bucketLabel(completeBucket, analytics, 'en-US', timeZone);
}

describe('formatDuration', () => {
  it('omits the minute suffix for exact-hour durations', () => {
    expect(formatDuration(60 * 60 * 1000)).toBe('1h');
    expect(formatDuration(2 * 60 * 60 * 1000)).toBe('2h');
  });

  it('keeps minutes for partial hours', () => {
    expect(formatDuration(90 * 60 * 1000)).toBe('1h 30m');
    expect(formatDuration(30 * 60 * 1000)).toBe('30m');
  });
});

describe('Study Rhythm bucket labels', () => {
  it('derives quarters from the analytics timezone at a month boundary', () => {
    const bucket = {
      startsAt: '2026-04-01T00:30:00Z',
      endsAt: '2026-07-01T00:30:00Z',
    };

    expect(labelFor(bucket, 'quarter', 1, 'UTC')).toBe('Q2 2026');
    expect(labelFor(bucket, 'quarter', 1, 'America/Los_Angeles')).toBe('Q1 2026');
  });

  it('keeps multi-year labels numeric and timezone-aware', () => {
    const bucket = {
      startsAt: '2020-01-01T00:30:00Z',
      endsAt: '2025-01-01T00:00:00Z',
    };

    expect(labelFor(bucket, 'year', 5, 'UTC')).toBe('2020–2024');
    expect(labelFor(bucket, 'year', 5, 'America/Los_Angeles')).toBe('2019–2024');
  });
});
