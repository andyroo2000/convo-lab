import { useEffect, useState } from 'react';

import type {
  StudyActivityCategory,
  StudyTimeAnalyticsBucket,
  StudyTimeRange,
} from '../types/studyActivity';
import shiftStudyTimeAnchor, {
  localDateKey,
  safeTimeZone,
  zonedDateKey,
} from '../utils/studyTimePeriod';
import { useStudyActivityAnalytics } from './useStudyActivity';

function drillDownRange(range: StudyTimeRange): StudyTimeRange | null {
  if (range === 'year') return 'month';
  if (range === 'week' || range === 'month') return 'today';
  return null;
}

export default function useStudyTimeAnalyticsView(categories: readonly StudyActivityCategory[]) {
  // The bootstrap request must use the device date until the API reports its analytics timezone.
  const [anchorDate, setAnchorDate] = useState(() => localDateKey(new Date()));
  const analyticsQuery = useStudyActivityAnalytics(anchorDate);
  const [range, setRange] = useState<StudyTimeRange>('week');
  const [includedCategories, setIncludedCategories] = useState<Set<StudyActivityCategory>>(
    () => new Set(categories)
  );
  const [slideDirection, setSlideDirection] = useState<-1 | 1>(-1);
  const [mobileSwipeEnabled, setMobileSwipeEnabled] = useState(false);
  const analytics = analyticsQuery.data?.ranges.find((item) => item.key === range);
  const displayedAnchorDate = analyticsQuery.data?.anchorDate ?? anchorDate;
  const canNavigateLater =
    range !== 'all' &&
    Boolean(
      analytics &&
      new Date(analytics.endsAt).getTime() <=
        new Date(analyticsQuery.data?.generatedAt ?? analytics.endsAt).getTime()
    );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(max-width: 639px)');
    const update = () => setMobileSwipeEnabled(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const selectRange = (nextRange: StudyTimeRange) => {
    setRange(nextRange);
    setAnchorDate(
      analyticsQuery.data
        ? zonedDateKey(
            new Date(analyticsQuery.data.generatedAt),
            safeTimeZone(analyticsQuery.data.timezone)
          )
        : localDateKey(new Date())
    );
    setSlideDirection(-1);
  };

  const navigatePeriod = (amount: -1 | 1) => {
    if (range === 'all' || analyticsQuery.isFetching || (amount === 1 && !canNavigateLater)) {
      return;
    }
    setSlideDirection(amount);
    setAnchorDate(shiftStudyTimeAnchor(displayedAnchorDate, range, amount));
  };

  const toggleCategory = (category: StudyActivityCategory) => {
    setIncludedCategories((current) => {
      if (current.has(category) && current.size === 1) return current;
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const drillDown = (bucket: StudyTimeAnalyticsBucket) => {
    const nextRange = drillDownRange(range);
    if (!nextRange) return;
    setSlideDirection(-1);
    setAnchorDate(
      zonedDateKey(new Date(bucket.startsAt), safeTimeZone(analyticsQuery.data?.timezone))
    );
    setRange(nextRange);
  };

  return {
    analytics,
    analyticsQuery,
    canNavigateLater,
    drillDown,
    drillDownEnabled: drillDownRange(range) !== null,
    includedCategories,
    mobileSwipeEnabled,
    navigatePeriod,
    range,
    selectRange,
    slideDirection,
    toggleCategory,
    transitionKey: `${displayedAnchorDate}-${range}`,
  };
}
