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
  const projection = buildStudyTimeAnalyticsProjection({
    analytics,
    categories: CATEGORY_KEYS,
    generatedAt,
    includedCategories,
    timeZone,
  });
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
          <p className="mt-1 text-xl font-black text-navy">
            {projection.bestBucket
              ? bucketLabel(projection.bestBucket.bucket, analytics, locale, timeZone)
              : '—'}
          </p>
          <p className="text-sm font-bold text-gray-500">
            {t('time.analytics.bucketTotal', {
              time: projection.bestBucket
                ? formatDuration(projection.bestBucket.totalMs)
                : formatDuration(0),
            })}
          </p>
        </div>
      </div>

      <div
        className="mt-6 min-w-0 overflow-hidden pb-2"
        data-testid={`study-rhythm-chart-container-${analytics.key}`}
      >
        <div
          className="grid h-64 w-full min-w-0 items-end gap-0.5 border-b-2 border-navy/20 px-0.5"
          style={{
            gridTemplateColumns: `repeat(${Math.max(analytics.buckets.length, 1)}, 1fr)`,
          }}
          aria-label={t('time.analytics.chartLabel')}
          data-testid={`study-rhythm-chart-${analytics.key}`}
        >
          {projection.buckets.map(({ bucket, categoryTotals, totalMs }) => (
            <div
              key={bucket.startsAt}
              className="flex h-full min-w-0 flex-col justify-end"
              data-testid="study-rhythm-chart-bucket"
            >
              <button
                type="button"
                className={`touch-manipulation flex min-h-0 w-full flex-col-reverse overflow-hidden rounded-t-sm border-0 p-0 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral ${
                  onDrillDown ? 'cursor-pointer' : 'cursor-default'
                }`}
                style={{
                  height: `${Math.max(2, (totalMs / projection.maximumBucketMs) * 88)}%`,
                }}
                title={`${bucketLabel(bucket, analytics, locale, timeZone)}: ${t(
                  'time.analytics.bucketTotal',
                  { time: formatDuration(totalMs) }
                )}`}
                aria-label={`${bucketLabel(bucket, analytics, locale, timeZone)}: ${formatDuration(
                  totalMs
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
                {STUDY_TIME_CATEGORIES.map((category) => {
                  if (!includedCategories.has(category.key)) return null;
                  const value = categoryTotals[category.key] ?? 0;
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
                {bucketLabel(bucket, analytics, locale, timeZone)}
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
        {STUDY_TIME_CATEGORIES.map((category) => {
          const categoryProjection = projection.categories.find(
            (item) => item.category === category.key
          );
          const included = categoryProjection?.included ?? false;
          const categoryTotalMs = categoryProjection?.totalMs ?? 0;
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
              aria-label={`${t(category.labelKey)}: ${formatDuration(categoryTotalMs)}. ${t(
                'time.analytics.toggleCategory'
              )}`}
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
                {formatDuration(categoryTotalMs)}
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
  const analyticsTimeZone = safeTimeZone(analyticsQuery.data?.timezone);
  const selectedPeriodLabel = analytics ? periodLabel(analytics, locale, analyticsTimeZone) : '';

  return (
    <section className="retro-paper-panel p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-end justify-end gap-3">
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
                timeZone={analyticsTimeZone}
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
