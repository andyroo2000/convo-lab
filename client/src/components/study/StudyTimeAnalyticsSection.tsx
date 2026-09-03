import { useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import STUDY_TIME_CATEGORIES from '../../data/studyTimeCategories';
import useStudyTimeAnalyticsView from '../../hooks/useStudyTimeAnalyticsView';
import type {
  StudyActivityCategory,
  StudyTimeAnalyticsBucket,
  StudyTimeAnalyticsRange,
  StudyTimeRange,
} from '../../types/studyActivity';
import buildStudyTimeAnalyticsProjection from '../../utils/studyTimeAnalyticsModel';
import formatDuration from '../../utils/studyTimeFormat';
import bucketLabel from '../../utils/studyTimeLabels';
import { safeTimeZone } from '../../utils/studyTimePeriod';

const CATEGORY_KEYS = STUDY_TIME_CATEGORIES.map((category) => category.key);
const RANGES: StudyTimeRange[] = ['today', 'week', 'month', 'year', 'all'];
const SWIPE_THRESHOLD_PX = 50;
const SWIPE_VELOCITY_THRESHOLD = 500;
const DOUBLE_TAP_WINDOW_MS = 420;

function periodLabel(analytics: StudyTimeAnalyticsRange, locale: string, timeZone: string) {
  const start = new Date(analytics.startsAt);
  const inclusiveEnd = new Date(new Date(analytics.endsAt).getTime() - 1);
  if (analytics.key === 'today') {
    return start.toLocaleDateString(locale, {
      timeZone,
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }
  if (analytics.key === 'month') {
    return start.toLocaleDateString(locale, { timeZone, month: 'long', year: 'numeric' });
  }
  if (analytics.key === 'year') {
    return start.toLocaleDateString(locale, { timeZone, year: 'numeric' });
  }
  if (analytics.key === 'all') return '';

  const startLabel = start.toLocaleDateString(locale, {
    timeZone,
    month: 'short',
    day: 'numeric',
  });
  const endLabel = inclusiveEnd.toLocaleDateString(locale, {
    timeZone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${startLabel} – ${endLabel}`;
}

function analyticsSlideOffset(
  direction: -1 | 1,
  phase: 'enter' | 'exit',
  reduceMotion: boolean | null
) {
  if (reduceMotion) return 0;
  if (phase === 'enter') return direction === -1 ? '-105%' : '105%';
  return direction === -1 ? '105%' : '-105%';
}

type StudyTimeProjection = ReturnType<typeof buildStudyTimeAnalyticsProjection>;
type StudyTimeCategoryDefinition = (typeof STUDY_TIME_CATEGORIES)[number];
type TouchActivation = (key: string, pointerType: string, activate: () => void) => void;

const useChartActivation = () => {
  const lastTouchActivation = useRef({ key: '', timestamp: 0 });
  const handleTouchActivation = (key: string, pointerType: string, activate: () => void) => {
    if (pointerType === 'mouse') return;
    const timestamp = Date.now();
    if (
      lastTouchActivation.current.key === key &&
      timestamp - lastTouchActivation.current.timestamp <= DOUBLE_TAP_WINDOW_MS
    ) {
      activate();
      lastTouchActivation.current = { key: '', timestamp };
      return;
    }
    lastTouchActivation.current = { key, timestamp };
  };
  const handleMouseDoubleClick = (activate: () => void) => {
    if (Date.now() - lastTouchActivation.current.timestamp <= DOUBLE_TAP_WINDOW_MS) return;
    activate();
  };
  return { handleMouseDoubleClick, handleTouchActivation };
};

const StudyRhythmSummary = ({
  analytics,
  locale,
  projection,
  timeZone,
}: {
  analytics: StudyTimeAnalyticsRange;
  locale: string;
  projection: StudyTimeProjection;
  timeZone: string;
}) => {
  const { t } = useTranslation(['study']);
  const bestBucketLabel = projection.bestBucket
    ? bucketLabel(projection.bestBucket.bucket, analytics, locale, timeZone)
    : '—';
  const bestBucketTotal = projection.bestBucket?.totalMs ?? 0;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div
        className="rounded-xl border border-navy/10 bg-white/70 p-4"
        data-testid="study-time-total"
      >
        <p className="retro-caps text-gray-500">{t('time.totals.total')}</p>
        <p className="mt-1 text-3xl font-black text-navy">{formatDuration(projection.totalMs)}</p>
      </div>
      <div className="rounded-xl border border-navy/10 bg-white/70 p-4">
        <p className="retro-caps text-gray-500">{t('time.analytics.dailyAverage')}</p>
        <p className="mt-1 text-3xl font-black text-navy">
          {formatDuration(projection.dailyAverageMs)}
        </p>
      </div>
      <div className="rounded-xl border border-navy/10 bg-white/70 p-4">
        <p className="retro-caps text-gray-500">{t('time.analytics.bestRhythm')}</p>
        <p className="mt-1 text-xl font-black text-navy">{bestBucketLabel}</p>
        <p className="text-sm font-bold text-gray-500">
          {t('time.analytics.bucketTotal', { time: formatDuration(bestBucketTotal) })}
        </p>
      </div>
    </div>
  );
};

const CategoryBar = ({
  category,
  categoryTotals,
  includedCategories,
}: {
  category: StudyTimeCategoryDefinition;
  categoryTotals: Record<string, number>;
  includedCategories: ReadonlySet<StudyActivityCategory>;
}) => {
  const { t } = useTranslation(['study']);
  if (!includedCategories.has(category.key)) return null;
  const value = categoryTotals[category.key] ?? 0;
  if (value === 0) return null;
  return (
    <div
      className={`${category.barColor} min-h-[2px]`}
      style={{ flexGrow: value }}
      title={`${t(category.labelKey)}: ${formatDuration(value)}`}
    />
  );
};

const isKeyboardActivation = (key: string) => key === 'Enter' || key === ' ';

const RhythmBucket = ({
  analytics,
  bucket,
  categoryTotals,
  handleMouseDoubleClick,
  handleTouchActivation,
  includedCategories,
  locale,
  maximumBucketMs,
  onDrillDown,
  timeZone,
  totalMs,
}: {
  analytics: StudyTimeAnalyticsRange;
  bucket: StudyTimeAnalyticsBucket;
  categoryTotals: Record<string, number>;
  handleMouseDoubleClick: (activate: () => void) => void;
  handleTouchActivation: TouchActivation;
  includedCategories: ReadonlySet<StudyActivityCategory>;
  locale: string;
  maximumBucketMs: number;
  onDrillDown?: (bucket: StudyTimeAnalyticsBucket) => void;
  timeZone: string;
  totalMs: number;
}) => {
  const { t } = useTranslation(['study']);
  const label = bucketLabel(bucket, analytics, locale, timeZone);
  const totalLabel = t('time.analytics.bucketTotal', { time: formatDuration(totalMs) });
  const activate = () => onDrillDown?.(bucket);
  const handleDoubleClick = () => {
    if (!onDrillDown) return;
    handleMouseDoubleClick(activate);
  };
  const handlePointerUp = (event: React.PointerEvent) => {
    if (!onDrillDown) return;
    handleTouchActivation(`bucket-${bucket.startsAt}`, event.pointerType, activate);
  };
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!onDrillDown) return;
    if (!isKeyboardActivation(event.key)) return;
    event.preventDefault();
    onDrillDown(bucket);
  };
  return (
    <div
      className="flex h-full min-w-0 flex-col justify-end"
      data-testid="study-rhythm-chart-bucket"
    >
      <button
        type="button"
        className={`touch-manipulation flex min-h-0 w-full flex-col-reverse overflow-hidden rounded-t-sm border-0 p-0 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral ${
          onDrillDown ? 'cursor-pointer' : 'cursor-default'
        }`}
        style={{ height: `${Math.max(2, (totalMs / maximumBucketMs) * 88)}%` }}
        title={`${label}: ${totalLabel}`}
        aria-label={`${label}: ${formatDuration(totalMs)}${
          onDrillDown ? `. ${t('time.analytics.drillDown')}` : ''
        }`}
        onDoubleClick={handleDoubleClick}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
        disabled={!onDrillDown}
      >
        {STUDY_TIME_CATEGORIES.map((category) => (
          <CategoryBar
            key={category.key}
            category={category}
            categoryTotals={categoryTotals}
            includedCategories={includedCategories}
          />
        ))}
      </button>
      <p className="mt-2 truncate text-center text-[11px] font-bold text-gray-500">{label}</p>
    </div>
  );
};

const StudyRhythmBars = ({
  analytics,
  handleMouseDoubleClick,
  handleTouchActivation,
  includedCategories,
  locale,
  onDrillDown,
  projection,
  timeZone,
}: {
  analytics: StudyTimeAnalyticsRange;
  handleMouseDoubleClick: (activate: () => void) => void;
  handleTouchActivation: TouchActivation;
  includedCategories: ReadonlySet<StudyActivityCategory>;
  locale: string;
  onDrillDown?: (bucket: StudyTimeAnalyticsBucket) => void;
  projection: StudyTimeProjection;
  timeZone: string;
}) => {
  const { t } = useTranslation(['study']);
  return (
    <div
      className="mt-6 min-w-0 overflow-hidden pb-2"
      data-testid={`study-rhythm-chart-container-${analytics.key}`}
    >
      <div
        className="grid h-64 w-full min-w-0 items-end gap-0.5 border-b-2 border-navy/20 px-0.5"
        style={{ gridTemplateColumns: `repeat(${Math.max(analytics.buckets.length, 1)}, 1fr)` }}
        aria-label={t('time.analytics.chartLabel')}
        data-testid={`study-rhythm-chart-${analytics.key}`}
      >
        {projection.buckets.map(({ bucket, categoryTotals, totalMs }) => (
          <RhythmBucket
            key={bucket.startsAt}
            analytics={analytics}
            bucket={bucket}
            categoryTotals={categoryTotals}
            handleMouseDoubleClick={handleMouseDoubleClick}
            handleTouchActivation={handleTouchActivation}
            includedCategories={includedCategories}
            locale={locale}
            maximumBucketMs={projection.maximumBucketMs}
            onDrillDown={onDrillDown}
            timeZone={timeZone}
            totalMs={totalMs}
          />
        ))}
      </div>
    </div>
  );
};

const CategoryFilter = ({
  category,
  handleMouseDoubleClick,
  handleTouchActivation,
  includedCategories,
  onToggleCategory,
  projection,
}: {
  category: StudyTimeCategoryDefinition;
  handleMouseDoubleClick: (activate: () => void) => void;
  handleTouchActivation: TouchActivation;
  includedCategories: ReadonlySet<StudyActivityCategory>;
  onToggleCategory: (category: StudyActivityCategory) => void;
  projection: StudyTimeProjection;
}) => {
  const { t } = useTranslation(['study']);
  const categoryProjection = projection.categories.find((item) => item.category === category.key);
  const included = categoryProjection?.included ?? false;
  const categoryTotalMs = categoryProjection?.totalMs ?? 0;
  const isOnlyIncludedCategory = included && includedCategories.size === 1;
  const activate = () => onToggleCategory(category.key);
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!isKeyboardActivation(event.key)) return;
    event.preventDefault();
    activate();
  };
  return (
    <button
      type="button"
      className={`touch-manipulation flex min-h-11 items-center justify-between gap-2 rounded-full border-2 px-3 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral ${
        included
          ? `${category.borderColor} bg-white/75 text-gray-700`
          : 'border-navy/10 bg-navy/5 text-gray-400 opacity-60'
      } disabled:cursor-not-allowed`}
      aria-pressed={included}
      aria-label={`${t(category.labelKey)}: ${formatDuration(categoryTotalMs)}. ${t(
        'time.analytics.toggleCategory'
      )}`}
      disabled={isOnlyIncludedCategory}
      onDoubleClick={() => handleMouseDoubleClick(activate)}
      onPointerUp={(event) =>
        handleTouchActivation(`category-${category.key}`, event.pointerType, activate)
      }
      onKeyDown={handleKeyDown}
    >
      <span className="flex items-center gap-2 text-sm font-bold text-gray-600">
        <span className={`h-2.5 w-2.5 rounded-full ${category.barColor}`} />
        {t(category.labelKey)}
      </span>
      <span className={`font-mono text-sm font-black ${category.color}`}>
        {formatDuration(categoryTotalMs)}
      </span>
    </button>
  );
};

const CategoryFilters = ({
  handleMouseDoubleClick,
  handleTouchActivation,
  includedCategories,
  onToggleCategory,
  projection,
}: {
  handleMouseDoubleClick: (activate: () => void) => void;
  handleTouchActivation: TouchActivation;
  includedCategories: ReadonlySet<StudyActivityCategory>;
  onToggleCategory: (category: StudyActivityCategory) => void;
  projection: StudyTimeProjection;
}) => {
  const { t } = useTranslation(['study']);
  return (
    <div
      className="mt-5 grid gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6"
      aria-label={t('time.analytics.categoryFilters')}
    >
      {STUDY_TIME_CATEGORIES.map((category) => (
        <CategoryFilter
          key={category.key}
          category={category}
          handleMouseDoubleClick={handleMouseDoubleClick}
          handleTouchActivation={handleTouchActivation}
          includedCategories={includedCategories}
          onToggleCategory={onToggleCategory}
          projection={projection}
        />
      ))}
    </div>
  );
};

const StudyRhythmChart = ({
  analytics,
  generatedAt,
  timeZone,
  includedCategories,
  onToggleCategory,
  onDrillDown,
}: {
  analytics: StudyTimeAnalyticsRange;
  generatedAt: string;
  timeZone: string;
  includedCategories: ReadonlySet<StudyActivityCategory>;
  onToggleCategory: (category: StudyActivityCategory) => void;
  onDrillDown?: (bucket: StudyTimeAnalyticsBucket) => void;
}) => {
  const { i18n, t } = useTranslation(['study']);
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const { handleMouseDoubleClick, handleTouchActivation } = useChartActivation();
  const projection = buildStudyTimeAnalyticsProjection({
    analytics,
    categories: CATEGORY_KEYS,
    generatedAt,
    includedCategories,
    timeZone,
  });

  return (
    <>
      <StudyRhythmSummary
        analytics={analytics}
        locale={locale}
        projection={projection}
        timeZone={timeZone}
      />
      <StudyRhythmBars
        analytics={analytics}
        handleMouseDoubleClick={handleMouseDoubleClick}
        handleTouchActivation={handleTouchActivation}
        includedCategories={includedCategories}
        locale={locale}
        onDrillDown={onDrillDown}
        projection={projection}
        timeZone={timeZone}
      />

      <p className="mt-4 text-xs font-semibold text-gray-500">
        {t('time.analytics.interactionHint')}
      </p>
      <CategoryFilters
        handleMouseDoubleClick={handleMouseDoubleClick}
        handleTouchActivation={handleTouchActivation}
        includedCategories={includedCategories}
        onToggleCategory={onToggleCategory}
        projection={projection}
      />
    </>
  );
};

const PeriodNavigation = ({
  canNavigateLater,
  isFetching,
  navigatePeriod,
  range,
}: {
  canNavigateLater: boolean;
  isFetching: boolean;
  navigatePeriod: (direction: -1 | 1) => void;
  range: StudyTimeRange;
}) => {
  const { t } = useTranslation(['study']);
  if (range === 'all') return null;
  return (
    <>
      <div className="hidden items-center gap-1 sm:flex">
        <button
          type="button"
          className="rounded-lg p-2 text-navy transition hover:bg-navy/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-coral disabled:cursor-not-allowed disabled:opacity-35"
          aria-label={t('time.analytics.previousPeriod')}
          onClick={() => navigatePeriod(-1)}
          disabled={isFetching}
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="rounded-lg p-2 text-navy transition hover:bg-navy/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-coral disabled:cursor-not-allowed disabled:opacity-35"
          aria-label={t('time.analytics.nextPeriod')}
          onClick={() => navigatePeriod(1)}
          disabled={!canNavigateLater || isFetching}
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <button
        type="button"
        className="sr-only sm:hidden"
        aria-label={t('time.analytics.previousPeriod')}
        onClick={() => navigatePeriod(-1)}
        disabled={isFetching}
      />
      <button
        type="button"
        className="sr-only sm:hidden"
        aria-label={t('time.analytics.nextPeriod')}
        onClick={() => navigatePeriod(1)}
        disabled={!canNavigateLater || isFetching}
      />
    </>
  );
};

const RangePicker = ({
  range,
  selectRange,
}: {
  range: StudyTimeRange;
  selectRange: (range: StudyTimeRange) => void;
}) => {
  const { t } = useTranslation(['study']);
  return (
    <fieldset
      className="grid min-w-0 grid-cols-5 rounded-lg border border-gray-200 bg-gray-50 p-1"
      aria-label={t('time.analytics.timeSpan')}
    >
      {RANGES.map((item) => (
        <label key={item} htmlFor={`study-time-range-${item}`} className="cursor-pointer">
          <input
            id={`study-time-range-${item}`}
            className="peer sr-only"
            type="radio"
            name="study-time-range"
            value={item}
            checked={range === item}
            onChange={() => selectRange(item)}
          />
          <span
            className={`block rounded-lg px-2.5 py-2 text-center text-xs font-black uppercase tracking-wide transition peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-coral sm:px-4 ${
              range === item ? 'bg-navy text-white shadow-sm' : 'text-gray-500 hover:text-navy'
            }`}
          >
            {t(`time.analytics.ranges.${item}`)}
          </span>
        </label>
      ))}
    </fieldset>
  );
};

const PeriodControls = ({
  canNavigateLater,
  isFetching,
  navigatePeriod,
  range,
  selectRange,
  selectedPeriodLabel,
}: {
  canNavigateLater: boolean;
  isFetching: boolean;
  navigatePeriod: (direction: -1 | 1) => void;
  range: StudyTimeRange;
  selectRange: (range: StudyTimeRange) => void;
  selectedPeriodLabel: string;
}) => (
  <div className="mb-6 flex flex-wrap items-end justify-end gap-3">
    <div className="flex max-w-full flex-col items-end gap-2">
      <div className="flex max-w-full items-center gap-2">
        <PeriodNavigation
          canNavigateLater={canNavigateLater}
          isFetching={isFetching}
          navigatePeriod={navigatePeriod}
          range={range}
        />
        <RangePicker range={range} selectRange={selectRange} />
      </div>
      {selectedPeriodLabel ? (
        <p
          className="pr-1 text-xs font-bold text-gray-500"
          aria-live="polite"
          data-testid="study-time-period-label"
        >
          {selectedPeriodLabel}
        </p>
      ) : null}
    </div>
  </div>
);

const AnalyticsStatus = ({
  hasAnalytics,
  isError,
  isLoading,
}: {
  hasAnalytics: boolean;
  isError: boolean;
  isLoading: boolean;
}) => {
  const { t } = useTranslation(['study']);
  if (isLoading) {
    return (
      <div className="flex h-72 items-center justify-center text-gray-500">
        {t('time.analytics.loading')}
      </div>
    );
  }
  if (isError) {
    return <div className="rounded-xl bg-red-50 p-5 text-red-800">{t('time.analytics.error')}</div>;
  }
  if (!hasAnalytics) {
    return <div className="rounded-xl bg-red-50 p-5 text-red-800">{t('time.analytics.error')}</div>;
  }
  return null;
};

const swipeDirection = (offsetX: number, velocityX: number): -1 | 1 | null => {
  const distanceRatio = Math.abs(offsetX) / SWIPE_THRESHOLD_PX;
  const velocityRatio = Math.abs(velocityX) / SWIPE_VELOCITY_THRESHOLD;
  if (Math.max(distanceRatio, velocityRatio) <= 1) return null;
  if (offsetX === 0) return null;
  return offsetX > 0 ? -1 : 1;
};

const canSwipeAnalytics = (mobileSwipeEnabled: boolean, range: StudyTimeRange) => {
  if (!mobileSwipeEnabled) return false;
  return range !== 'all';
};

const analyticsMotionVariants = (reduceMotion: boolean | null) => ({
  enter: (direction: -1 | 1) => ({
    x: analyticsSlideOffset(direction, 'enter', reduceMotion),
    opacity: reduceMotion ? 1 : 0.72,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: -1 | 1) => ({
    x: analyticsSlideOffset(direction, 'exit', reduceMotion),
    opacity: reduceMotion ? 1 : 0.72,
  }),
});

const analyticsMotionTransition = (reduceMotion: boolean | null) =>
  reduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 320, damping: 34, mass: 0.9 };

const AnalyticsChartPanel = ({
  analytics,
  analyticsTimeZone,
  drillDown,
  drillDownEnabled,
  generatedAt,
  includedCategories,
  isFetching,
  mobileSwipeEnabled,
  navigatePeriod,
  range,
  reduceMotion,
  slideDirection,
  toggleCategory,
  transitionKey,
}: {
  analytics: StudyTimeAnalyticsRange | undefined;
  analyticsTimeZone: string;
  drillDown: (bucket: StudyTimeAnalyticsBucket) => void;
  drillDownEnabled: boolean;
  generatedAt?: string;
  includedCategories: ReadonlySet<StudyActivityCategory>;
  isFetching: boolean;
  mobileSwipeEnabled: boolean;
  navigatePeriod: (direction: -1 | 1) => void;
  range: StudyTimeRange;
  reduceMotion: boolean | null;
  slideDirection: -1 | 1;
  toggleCategory: (category: StudyActivityCategory) => void;
  transitionKey: string;
}) => {
  const dragEnabled = canSwipeAnalytics(mobileSwipeEnabled, range);
  const handleDragEnd = (offsetX: number, velocityX: number) => {
    if (!dragEnabled) return;
    if (isFetching) return;
    const direction = swipeDirection(offsetX, velocityX);
    if (direction) navigatePeriod(direction);
  };
  return (
    <div
      className="relative overflow-hidden"
      data-testid="study-time-period-swipe-region"
      aria-busy={isFetching}
    >
      <AnimatePresence initial={false} custom={slideDirection} mode="popLayout">
        {analytics ? (
          <motion.div
            key={transitionKey}
            custom={slideDirection}
            variants={analyticsMotionVariants(reduceMotion)}
            initial="enter"
            animate="center"
            exit="exit"
            transition={analyticsMotionTransition(reduceMotion)}
            drag={dragEnabled ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.35}
            onDragEnd={(_, info) => handleDragEnd(info.offset.x, info.velocity.x)}
            style={{ touchAction: 'pan-y' }}
          >
            <StudyRhythmChart
              analytics={analytics}
              generatedAt={generatedAt ?? analytics.endsAt}
              timeZone={analyticsTimeZone}
              includedCategories={includedCategories}
              onToggleCategory={toggleCategory}
              onDrillDown={drillDownEnabled ? drillDown : undefined}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

const StudyTimeAnalyticsSection = () => {
  const { i18n, t } = useTranslation(['study']);
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const reduceMotion = useReducedMotion();
  const {
    analytics,
    analyticsQuery,
    canNavigateLater,
    drillDown,
    drillDownEnabled,
    includedCategories,
    mobileSwipeEnabled,
    navigatePeriod,
    range,
    selectRange,
    slideDirection,
    toggleCategory,
    transitionKey,
  } = useStudyTimeAnalyticsView(CATEGORY_KEYS);
  const analyticsTimeZone = safeTimeZone(analyticsQuery.data?.timezone);
  const selectedPeriodLabel = analytics ? periodLabel(analytics, locale, analyticsTimeZone) : '';

  return (
    <section className="card app-surface p-4 sm:p-6" aria-labelledby="study-time-analytics-heading">
      <h2 id="study-time-analytics-heading" className="sr-only">
        {t('time.analytics.sectionTitle')}
      </h2>
      <PeriodControls
        canNavigateLater={canNavigateLater}
        isFetching={analyticsQuery.isFetching}
        navigatePeriod={navigatePeriod}
        range={range}
        selectRange={selectRange}
        selectedPeriodLabel={selectedPeriodLabel}
      />
      <AnalyticsStatus
        hasAnalytics={Boolean(analytics)}
        isError={analyticsQuery.isError}
        isLoading={analyticsQuery.isLoading}
      />
      <AnalyticsChartPanel
        analytics={analytics}
        analyticsTimeZone={analyticsTimeZone}
        drillDown={drillDown}
        drillDownEnabled={drillDownEnabled}
        generatedAt={analyticsQuery.data?.generatedAt}
        includedCategories={includedCategories}
        isFetching={analyticsQuery.isFetching}
        mobileSwipeEnabled={mobileSwipeEnabled}
        navigatePeriod={navigatePeriod}
        range={range}
        reduceMotion={reduceMotion}
        slideDirection={slideDirection}
        toggleCategory={toggleCategory}
        transitionKey={transitionKey}
      />
    </section>
  );
};

export default StudyTimeAnalyticsSection;
