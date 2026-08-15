import type {
  StudyActivityCategory,
  StudyTimeAnalyticsBucket,
  StudyTimeAnalyticsRange,
} from '../types/studyActivity';
import { calendarDayCount } from './studyTimePeriod';

export interface StudyTimeCategoryProjection {
  category: StudyActivityCategory;
  included: boolean;
  totalMs: number;
}

export interface StudyTimeBucketProjection {
  bucket: StudyTimeAnalyticsBucket;
  categoryTotals: Partial<Record<StudyActivityCategory, number>>;
  totalMs: number;
}

export interface StudyTimeAnalyticsProjection {
  bestBucket: StudyTimeBucketProjection | null;
  buckets: StudyTimeBucketProjection[];
  categories: StudyTimeCategoryProjection[];
  dailyAverageMs: number;
  maximumBucketMs: number;
  totalMs: number;
}

interface BuildStudyTimeAnalyticsProjectionOptions {
  analytics: StudyTimeAnalyticsRange;
  categories: readonly StudyActivityCategory[];
  generatedAt: string;
  includedCategories: ReadonlySet<StudyActivityCategory>;
  timeZone: string;
}

export default function buildStudyTimeAnalyticsProjection({
  analytics,
  categories,
  generatedAt,
  includedCategories,
  timeZone,
}: BuildStudyTimeAnalyticsProjectionOptions): StudyTimeAnalyticsProjection {
  const categoryProjection = categories.map((category) => ({
    category,
    included: includedCategories.has(category),
    totalMs: analytics.categories[category] ?? 0,
  }));
  const buckets = analytics.buckets.map((bucket) => {
    const categoryTotals: Partial<Record<StudyActivityCategory, number>> = {};
    let totalMs = 0;

    categoryProjection.forEach(({ category, included }) => {
      if (!included) return;
      const value = bucket.categories[category] ?? 0;
      categoryTotals[category] = value;
      totalMs += value;
    });

    return { bucket, categoryTotals, totalMs };
  });
  const totalMs = categoryProjection.reduce(
    (total, category) => total + (category.included ? category.totalMs : 0),
    0
  );
  const bestBucket = buckets.reduce<StudyTimeBucketProjection | null>((winner, bucket) => {
    if (bucket.totalMs <= 0) return winner;
    return !winner || bucket.totalMs > winner.totalMs ? bucket : winner;
  }, null);
  const elapsedEndsAt = new Date(
    Math.min(new Date(generatedAt).getTime(), new Date(analytics.endsAt).getTime())
  );
  const elapsedDays = calendarDayCount(analytics.startsAt, elapsedEndsAt, timeZone);

  return {
    bestBucket,
    buckets,
    categories: categoryProjection,
    dailyAverageMs: Math.round(totalMs / elapsedDays),
    maximumBucketMs: Math.max(...buckets.map((bucket) => bucket.totalMs), 1),
    totalMs,
  };
}
