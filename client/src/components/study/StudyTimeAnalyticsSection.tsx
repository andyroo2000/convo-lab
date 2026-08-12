import { useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import useStudyTimeAnalyticsView from '../../hooks/useStudyTimeAnalyticsView';
import type {
  StudyActivityCategory,
  StudyTimeAnalyticsBucket,
  StudyTimeAnalyticsRange,
  StudyTimeRange,
} from '../../types/studyActivity';
import formatDuration from '../../utils/studyTimeFormat';
import { calendarDayCount } from '../../utils/studyTimePeriod';

const CATEGORIES: Array<{
  key: StudyActivityCategory;
  labelKey: string;
  color: string;
  barColor: string;
  borderColor: string;
}> = [
  {
    key: 'review',
    labelKey: 'time.totals.review',
    color: 'text-blue-700',
    barColor: 'bg-blue-500',
    borderColor: 'border-blue-500',
  },
  {
    key: 'listen',
    labelKey: 'time.totals.listen',
    color: 'text-cyan-700',
    barColor: 'bg-cyan-500',
    borderColor: 'border-cyan-500',
  },
  {
    key: 'create',
    labelKey: 'time.totals.create',
    color: 'text-amber-700',
    barColor: 'bg-amber-500',
    borderColor: 'border-amber-500',
  },
  {
    key: 'immerse',
    labelKey: 'time.totals.immerse',
    color: 'text-emerald-700',
    barColor: 'bg-emerald-500',
    borderColor: 'border-emerald-500',
  },
  {
    key: 'conversation',
    labelKey: 'time.totals.conversation',
    color: 'text-violet-700',
    barColor: 'bg-violet-500',
    borderColor: 'border-violet-500',
  },
  {
    key: 'wanikani',
    labelKey: 'time.totals.wanikani',
    color: 'text-pink-700',
    barColor: 'bg-pink-500',
    borderColor: 'border-pink-500',
  },
];

const CATEGORY_KEYS = CATEGORIES.map((category) => category.key);
const RANGES: StudyTimeRange[] = ['today', 'week', 'month', 'year', 'all'];
const SWIPE_THRESHOLD_PX = 50;
const SWIPE_VELOCITY_THRESHOLD = 500;
const DOUBLE_TAP_WINDOW_MS = 420;

function bucketLabel(
  bucket: StudyTimeAnalyticsBucket,
  analytics: StudyTimeAnalyticsRange,
  locale: string
) {
  const date = new Date(bucket.startsAt);
  const unit =
    analytics.bucketUnit ??
    ({ today: 'hour', week: 'day', month: 'day', year: 'month', all: 'year' } as const)[
      analytics.key
    ];
  const step = analytics.bucketStep ?? 1;

  if (unit === 'hour') return date.toLocaleTimeString(locale, { hour: 'numeric' });
  if (unit === 'day' && analytics.key === 'week') {
    return date.toLocaleDateString(locale, { weekday: 'short' });
  }
  if (unit === 'day' && analytics.key === 'month') {
    return date.toLocaleDateString(locale, { day: 'numeric' });
  }
  if (unit === 'day' || unit === 'week') {
    return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  }
  if (unit === 'month') {
    return date.toLocaleDateString(locale, {
      month: 'short',
      ...(analytics.key === 'all' ? { year: '2-digit' as const } : {}),
    });
  }
  if (unit === 'quarter') {
    const quarter = Math.floor(date.getMonth() / 3) + 1;
    const year = date.toLocaleDateString(locale, { year: 'numeric' });
    return `Q${quarter} ${year}`;
  }
  if (step > 1) {
    const inclusiveEnd = new Date(new Date(bucket.endsAt).getTime() - 1);
    return `${date.getFullYear()}–${inclusiveEnd.getFullYear()}`;
  }
  return date.toLocaleDateString(locale, { year: 'numeric' });
}

function periodLabel(analytics: StudyTimeAnalyticsRange, locale: string) {
  const start = new Date(analytics.startsAt);
  const inclusiveEnd = new Date(new Date(analytics.endsAt).getTime() - 1);
  if (analytics.key === 'today') {
    return start.toLocaleDateString(locale, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }
  if (analytics.key === 'month') {
    return start.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  }
  if (analytics.key === 'year') {
    return start.toLocaleDateString(locale, { year: 'numeric' });
  }
  if (analytics.key === 'all') return '';

  const startLabel = start.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  const endLabel = inclusiveEnd.toLocaleDateString(locale, {
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
  const lastTouchActivation = useRef({ key: '', timestamp: 0 });
  const filteredBucketTotal = (bucket: StudyTimeAnalyticsBucket) =>
    CATEGORIES.reduce(
      (total, category) =>
        total + (includedCategories.has(category.key) ? (bucket.categories[category.key] ?? 0) : 0),
      0
    );
  const filteredTotal = CATEGORIES.reduce(
    (total, category) =>
      total +
      (includedCategories.has(category.key) ? (analytics.categories[category.key] ?? 0) : 0),
    0
  );
  const maximum = Math.max(...analytics.buckets.map(filteredBucketTotal), 1);
  const best = analytics.buckets.reduce<StudyTimeAnalyticsBucket | null>((winner, bucket) => {
    const bucketTotal = filteredBucketTotal(bucket);
    if (bucketTotal <= 0) return winner;
    return !winner || bucketTotal > filteredBucketTotal(winner) ? bucket : winner;
  }, null);
  const elapsedEndsAt = new Date(
    Math.min(new Date(generatedAt).getTime(), new Date(analytics.endsAt).getTime())
  );
  const elapsedDays = calendarDayCount(analytics.startsAt, elapsedEndsAt, timeZone);
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

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <div
          className="rounded-xl border border-navy/10 bg-white/70 p-4"
          data-testid="study-time-total"
        >
          <p className="retro-caps text-gray-500">{t('time.totals.total')}</p>
          <p className="mt-1 text-3xl font-black text-navy">{formatDuration(filteredTotal)}</p>
        </div>
        <div className="rounded-xl border border-navy/10 bg-white/70 p-4">
          <p className="retro-caps text-gray-500">{t('time.analytics.dailyAverage')}</p>
          <p className="mt-1 text-3xl font-black text-navy">
            {formatDuration(Math.round(filteredTotal / elapsedDays))}
          </p>
        </div>
        <div className="rounded-xl border border-navy/10 bg-white/70 p-4">
          <p className="retro-caps text-gray-500">{t('time.analytics.bestRhythm')}</p>
          <p className="mt-1 text-xl font-black text-navy">
            {best ? bucketLabel(best, analytics, locale) : '—'}
          </p>
          <p className="text-sm font-bold text-gray-500">
            {t('time.analytics.bucketTotal', {
              time: best ? formatDuration(filteredBucketTotal(best)) : formatDuration(0),
            })}
          </p>
        </div>
      </div>

      <div
        className="mt-6 min-w-0 overflow-hidden pb-2"
        data-testid={`study-rhythm-chart-container-${analytics.key}`}
      >
        <div
          className="grid h-64 w-full min-w-0 items-end gap-1 border-b-2 border-navy/20 px-2 sm:gap-2"
          style={{
            gridTemplateColumns: `repeat(${Math.max(analytics.buckets.length, 1)}, 1fr)`,
          }}
          aria-label={t('time.analytics.chartLabel')}
          data-testid={`study-rhythm-chart-${analytics.key}`}
        >
          {analytics.buckets.map((bucket) => (
            <div
              key={bucket.startsAt}
              className="flex h-full min-w-0 flex-col justify-end"
              data-testid="study-rhythm-chart-bucket"
            >
              <button
                type="button"
                className={`touch-manipulation flex min-h-0 w-full flex-col-reverse overflow-hidden rounded-t-md border-0 p-0 text-left shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral ${
                  onDrillDown ? 'cursor-pointer' : 'cursor-default'
                }`}
                style={{
                  height: `${Math.max(2, (filteredBucketTotal(bucket) / maximum) * 88)}%`,
                }}
                title={`${bucketLabel(bucket, analytics, locale)}: ${t(
                  'time.analytics.bucketTotal',
                  { time: formatDuration(filteredBucketTotal(bucket)) }
                )}`}
                aria-label={`${bucketLabel(bucket, analytics, locale)}: ${formatDuration(
                  filteredBucketTotal(bucket)
                )}${onDrillDown ? `. ${t('time.analytics.drillDown')}` : ''}`}
                onDoubleClick={() =>
                  onDrillDown && handleMouseDoubleClick(() => onDrillDown(bucket))
                }
                onPointerUp={(event) =>
                  onDrillDown &&
                  handleTouchActivation(`bucket-${bucket.startsAt}`, event.pointerType, () =>
                    onDrillDown(bucket)
                  )
                }
                onKeyDown={(event) => {
                  if (onDrillDown && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    onDrillDown(bucket);
                  }
                }}
                disabled={!onDrillDown}
              >
                {CATEGORIES.map((category) => {
                  if (!includedCategories.has(category.key)) return null;
                  const value = bucket.categories[category.key] ?? 0;
                  if (value === 0) return null;
                  return (
                    <div
                      key={category.key}
                      className={`${category.barColor} min-h-[2px]`}
                      style={{ flexGrow: value }}
                      title={`${t(category.labelKey)}: ${formatDuration(value)}`}
                    />
                  );
                })}
              </button>
              <p className="mt-2 truncate text-center text-[11px] font-bold text-gray-500">
                {bucketLabel(bucket, analytics, locale)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-4 text-xs font-semibold text-gray-500">
        {t('time.analytics.interactionHint')}
      </p>

      <div
        className="mt-5 grid gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6"
        aria-label={t('time.analytics.categoryFilters')}
      >
        {CATEGORIES.map((category) => {
          const included = includedCategories.has(category.key);
          const isOnlyIncludedCategory = included && includedCategories.size === 1;
          return (
            <button
              type="button"
              key={category.key}
              className={`touch-manipulation flex min-h-11 items-center justify-between gap-2 rounded-full border-2 px-3 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral ${
                included
                  ? `${category.borderColor} bg-white/75 text-gray-700`
                  : 'border-navy/10 bg-navy/5 text-gray-400 opacity-60'
              } disabled:cursor-not-allowed`}
              aria-pressed={included}
              aria-label={`${t(category.labelKey)}: ${formatDuration(
                analytics.categories[category.key] ?? 0
              )}. ${t('time.analytics.toggleCategory')}`}
              disabled={isOnlyIncludedCategory}
              onDoubleClick={() => handleMouseDoubleClick(() => onToggleCategory(category.key))}
              onPointerUp={(event) =>
                handleTouchActivation(`category-${category.key}`, event.pointerType, () =>
                  onToggleCategory(category.key)
                )
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onToggleCategory(category.key);
                }
              }}
            >
              <span className="flex items-center gap-2 text-sm font-bold text-gray-600">
                <span className={`h-2.5 w-2.5 rounded-full ${category.barColor}`} />
                {t(category.labelKey)}
              </span>
              <span className={`font-mono text-sm font-black ${category.color}`}>
                {formatDuration(analytics.categories[category.key] ?? 0)}
              </span>
            </button>
          );
        })}
      </div>
    </>
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
  const selectedPeriodLabel = analytics ? periodLabel(analytics, locale) : '';

  return (
    <section className="retro-paper-panel p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="retro-caps text-coral">{t('time.analytics.eyebrow')}</p>
          <h2 className="retro-headline text-3xl text-navy">{t('time.analytics.title')}</h2>
        </div>
        <div className="flex max-w-full flex-col items-end gap-2">
          <div className="flex max-w-full items-center gap-2">
            {range !== 'all' ? (
              <>
                <div className="hidden items-center gap-1 sm:flex">
                  <button
                    type="button"
                    className="rounded-lg p-2 text-navy transition hover:bg-navy/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-coral disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label={t('time.analytics.previousPeriod')}
                    onClick={() => navigatePeriod(-1)}
                    disabled={analyticsQuery.isFetching}
                  >
                    <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="rounded-lg p-2 text-navy transition hover:bg-navy/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-coral disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label={t('time.analytics.nextPeriod')}
                    onClick={() => navigatePeriod(1)}
                    disabled={!canNavigateLater || analyticsQuery.isFetching}
                  >
                    <ChevronRight className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
                <button
                  type="button"
                  className="sr-only sm:hidden"
                  aria-label={t('time.analytics.previousPeriod')}
                  onClick={() => navigatePeriod(-1)}
                  disabled={analyticsQuery.isFetching}
                />
                <button
                  type="button"
                  className="sr-only sm:hidden"
                  aria-label={t('time.analytics.nextPeriod')}
                  onClick={() => navigatePeriod(1)}
                  disabled={!canNavigateLater || analyticsQuery.isFetching}
                />
              </>
            ) : null}
            <fieldset
              className="grid min-w-0 grid-cols-5 rounded-xl border-2 border-navy/10 bg-white/70 p-1"
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
                      range === item
                        ? 'bg-navy text-white shadow-sm'
                        : 'text-gray-500 hover:text-navy'
                    }`}
                  >
                    {t(`time.analytics.ranges.${item}`)}
                  </span>
                </label>
              ))}
            </fieldset>
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
      {analyticsQuery.isLoading ? (
        <div className="flex h-72 items-center justify-center text-gray-500">
          {t('time.analytics.loading')}
        </div>
      ) : null}
      {analyticsQuery.isError ? (
        <div className="rounded-xl bg-red-50 p-5 text-red-800">{t('time.analytics.error')}</div>
      ) : null}
      {!analyticsQuery.isLoading && !analyticsQuery.isError && !analytics ? (
        <div className="rounded-xl bg-red-50 p-5 text-red-800">{t('time.analytics.error')}</div>
      ) : null}
      <div
        className="relative overflow-hidden"
        data-testid="study-time-period-swipe-region"
        aria-busy={analyticsQuery.isFetching}
      >
        <AnimatePresence initial={false} custom={slideDirection} mode="popLayout">
          {analytics ? (
            <motion.div
              key={transitionKey}
              custom={slideDirection}
              variants={{
                enter: (direction: -1 | 1) => ({
                  x: analyticsSlideOffset(direction, 'enter', reduceMotion),
                  opacity: reduceMotion ? 1 : 0.72,
                }),
                center: { x: 0, opacity: 1 },
                exit: (direction: -1 | 1) => ({
                  x: analyticsSlideOffset(direction, 'exit', reduceMotion),
                  opacity: reduceMotion ? 1 : 0.72,
                }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { type: 'spring', stiffness: 320, damping: 34, mass: 0.9 }
              }
              drag={mobileSwipeEnabled && range !== 'all' ? 'x' : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.35}
              onDragEnd={(_, info) => {
                if (!mobileSwipeEnabled || analyticsQuery.isFetching) return;
                const intent =
                  Math.abs(info.offset.x) > SWIPE_THRESHOLD_PX ||
                  Math.abs(info.velocity.x) > SWIPE_VELOCITY_THRESHOLD;
                if (!intent) return;
                if (info.offset.x > 0) navigatePeriod(-1);
                if (info.offset.x < 0) navigatePeriod(1);
              }}
              style={{ touchAction: 'pan-y' }}
            >
              <StudyRhythmChart
                analytics={analytics}
                generatedAt={analyticsQuery.data?.generatedAt ?? analytics.endsAt}
                timeZone={analyticsQuery.data?.timezone ?? 'UTC'}
                includedCategories={includedCategories}
                onToggleCategory={toggleCategory}
                onDrillDown={drillDownEnabled ? drillDown : undefined}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </section>
  );
};

export default StudyTimeAnalyticsSection;
