import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Pencil,
  Play,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import ConfirmModal from '../components/common/ConfirmModal';
import { useStudyActivityActions, useStudyActivityStatus } from '../contexts/StudyActivityContext';
import {
  useDeleteStudyActivitySession,
  useSaveStudyActivitySession,
  useStudyActivityAnalytics,
  useStudyActivitySessions,
} from '../hooks/useStudyActivity';
import type {
  StudyActivityCategory,
  StudyActivityKind,
  StudyActivitySession,
  StudyTimeAnalyticsBucket,
  StudyTimeAnalyticsRange,
  StudyTimeRange,
} from '../types/studyActivity';
import formatDuration from '../utils/studyTimeFormat';
import shiftStudyTimeAnchor, { localDateKey } from '../utils/studyTimePeriod';

const CATEGORIES: Array<{
  key: StudyActivityCategory;
  labelKey: string;
  color: string;
  barColor: string;
}> = [
  {
    key: 'review',
    labelKey: 'time.totals.review',
    color: 'text-blue-700',
    barColor: 'bg-blue-500',
  },
  {
    key: 'listen',
    labelKey: 'time.totals.listen',
    color: 'text-cyan-700',
    barColor: 'bg-cyan-500',
  },
  {
    key: 'create',
    labelKey: 'time.totals.create',
    color: 'text-amber-700',
    barColor: 'bg-amber-500',
  },
  {
    key: 'immerse',
    labelKey: 'time.totals.immerse',
    color: 'text-emerald-700',
    barColor: 'bg-emerald-500',
  },
  {
    key: 'conversation',
    labelKey: 'time.totals.conversation',
    color: 'text-violet-700',
    barColor: 'bg-violet-500',
  },
  {
    key: 'wanikani',
    labelKey: 'time.totals.wanikani',
    color: 'text-pink-700',
    barColor: 'bg-pink-500',
  },
];

const RANGES: StudyTimeRange[] = ['today', 'week', 'month', 'year', 'all'];
const SWIPE_THRESHOLD_PX = 50;
const SWIPE_VELOCITY_THRESHOLD = 500;

const ACTIVITY_OPTIONS: Array<{
  activity: StudyActivityKind;
  category: StudyActivityCategory;
  labelKey: string;
}> = [
  { activity: 'card_creation', category: 'create', labelKey: 'time.activities.cardCreation' },
  { activity: 'tv', category: 'immerse', labelKey: 'time.activities.tv' },
  { activity: 'podcast', category: 'immerse', labelKey: 'time.activities.podcast' },
  { activity: 'reading', category: 'immerse', labelKey: 'time.activities.reading' },
  {
    activity: 'conversation',
    category: 'conversation',
    labelKey: 'time.activities.conversation',
  },
  {
    activity: 'wanikani_review',
    category: 'wanikani',
    labelKey: 'time.activities.wanikaniReview',
  },
  { activity: 'other', category: 'immerse', labelKey: 'time.activities.other' },
];

function googleCalendarUrl(
  name: string,
  start: Date,
  durationMinutes: number,
  defaultName: string,
  details: string
) {
  const end = new Date(start.getTime() + durationMinutes * 60000);
  const compact = (date: Date) =>
    date
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: name || defaultName,
    dates: `${compact(start)}/${compact(end)}`,
    details,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function localInputValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function bucketLabel(date: Date, range: StudyTimeRange, locale: string) {
  if (range === 'today') return date.toLocaleTimeString(locale, { hour: 'numeric' });
  if (range === 'week') return date.toLocaleDateString(locale, { weekday: 'short' });
  if (range === 'month') return date.toLocaleDateString(locale, { day: 'numeric' });
  if (range === 'year') return date.toLocaleDateString(locale, { month: 'short' });
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

function activityTranslationKey(activity: StudyActivityKind) {
  if (activity === 'card_review') return 'cardReview';
  if (activity === 'daily_audio') return 'dailyAudio';
  if (activity === 'card_creation') return 'cardCreation';
  if (activity === 'wanikani_review') return 'wanikaniReview';
  return activity;
}

const StudyRhythmChart = ({
  analytics,
  generatedAt,
}: {
  analytics: StudyTimeAnalyticsRange;
  generatedAt: string;
}) => {
  const { i18n, t } = useTranslation(['study']);
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const maximum = Math.max(...analytics.buckets.map((bucket) => bucket.totalMs), 1);
  const best = analytics.buckets.reduce<StudyTimeAnalyticsBucket | null>(
    (winner, bucket) => (!winner || bucket.totalMs > winner.totalMs ? bucket : winner),
    null
  );
  const elapsedDays = Math.max(
    1,
    Math.ceil(
      (Math.min(new Date(generatedAt).getTime(), new Date(analytics.endsAt).getTime()) -
        new Date(analytics.startsAt).getTime()) /
        86_400_000
    )
  );

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-navy/10 bg-white/70 p-4">
          <p className="retro-caps text-gray-500">{t('time.totals.total')}</p>
          <p className="mt-1 text-3xl font-black text-navy">{formatDuration(analytics.totalMs)}</p>
        </div>
        <div className="rounded-xl border border-navy/10 bg-white/70 p-4">
          <p className="retro-caps text-gray-500">{t('time.analytics.dailyAverage')}</p>
          <p className="mt-1 text-3xl font-black text-navy">
            {formatDuration(Math.round(analytics.totalMs / elapsedDays))}
          </p>
        </div>
        <div className="rounded-xl border border-navy/10 bg-white/70 p-4">
          <p className="retro-caps text-gray-500">{t('time.analytics.bestRhythm')}</p>
          <p className="mt-1 text-xl font-black text-navy">
            {best ? bucketLabel(new Date(best.startsAt), analytics.key, locale) : '—'}
          </p>
          <p className="text-sm font-bold text-gray-500">
            {t('time.analytics.bucketTotal', {
              time: best ? formatDuration(best.totalMs) : formatDuration(0),
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
              <div
                className="flex min-h-0 w-full flex-col-reverse overflow-hidden rounded-t-md shadow-sm"
                style={{
                  height: `${Math.max(2, (bucket.totalMs / maximum) * 88)}%`,
                }}
                title={`${bucketLabel(new Date(bucket.startsAt), analytics.key, locale)}: ${t(
                  'time.analytics.bucketTotal',
                  {
                    time: formatDuration(bucket.totalMs),
                  }
                )}`}
              >
                {CATEGORIES.map((category) => {
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
              </div>
              <p className="mt-2 truncate text-center text-[11px] font-bold text-gray-500">
                {bucketLabel(new Date(bucket.startsAt), analytics.key, locale)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {CATEGORIES.map((category) => (
          <div
            key={category.key}
            className="flex items-center justify-between gap-2 rounded-lg bg-white/60 px-3 py-2"
          >
            <span className="flex items-center gap-2 text-sm font-bold text-gray-600">
              <span className={`h-2.5 w-2.5 rounded-full ${category.barColor}`} />
              {t(category.labelKey)}
            </span>
            <span className={`font-mono text-sm font-black ${category.color}`}>
              {formatDuration(analytics.categories[category.key] ?? 0)}
            </span>
          </div>
        ))}
      </div>
    </>
  );
};

const StudyTimePage = () => {
  const { i18n, t } = useTranslation(['study']);
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const reduceMotion = useReducedMotion();
  const [sessionWindowEnd, setSessionWindowEnd] = useState(() => new Date(Date.now() + 60_000));
  const rollingStart = useMemo(
    () => new Date(sessionWindowEnd.getTime() - 93 * 86_400_000),
    [sessionWindowEnd]
  );
  const sessionsQuery = useStudyActivitySessions(rollingStart, sessionWindowEnd);
  const [anchorDate, setAnchorDate] = useState(() => localDateKey(new Date()));
  const analyticsQuery = useStudyActivityAnalytics(anchorDate);
  const saveSession = useSaveStudyActivitySession();
  const deleteSession = useDeleteStudyActivitySession();
  const { active } = useStudyActivityStatus();
  const { start, stop, logCompleted } = useStudyActivityActions();
  const [range, setRange] = useState<StudyTimeRange>('week');
  const [slideDirection, setSlideDirection] = useState<-1 | 1>(-1);
  const [mobileSwipeEnabled, setMobileSwipeEnabled] = useState(false);
  const [activity, setActivity] = useState<StudyActivityKind>('card_creation');
  const [name, setName] = useState('');
  const [entryDate, setEntryDate] = useState(() => localInputValue(new Date()));
  const [minutes, setMinutes] = useState(30);
  const [editing, setEditing] = useState<StudyActivitySession | null>(null);
  const [editActivity, setEditActivity] = useState<StudyActivityKind>('tv');
  const [editName, setEditName] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editMinutes, setEditMinutes] = useState(30);
  const [deletingSession, setDeletingSession] = useState<StudyActivitySession | null>(null);
  const editDialogRef = useRef<HTMLDivElement>(null);
  const saveResetRef = useRef(saveSession.reset);
  saveResetRef.current = saveSession.reset;
  const validEntry =
    Number.isFinite(minutes) &&
    minutes >= 1 &&
    minutes <= 1440 &&
    Number.isFinite(new Date(entryDate).getTime());

  const option = ACTIVITY_OPTIONS.find((item) => item.activity === activity) ?? ACTIVITY_OPTIONS[0];
  const analytics = analyticsQuery.data?.ranges.find((item) => item.key === range);
  const displayedAnchorDate = analyticsQuery.data?.anchorDate ?? anchorDate;
  const canNavigateLater =
    range !== 'all' &&
    Boolean(
      analytics &&
      new Date(analytics.endsAt).getTime() <=
        new Date(analyticsQuery.data?.generatedAt ?? analytics.endsAt).getTime()
    );
  const selectedPeriodLabel = analytics ? periodLabel(analytics, locale) : '';
  const manualSessions = useMemo(
    () =>
      [...(sessionsQuery.data ?? [])]
        .filter((session) => session.source !== 'automatic')
        .sort((left, right) => right.startedAt.localeCompare(left.startedAt)),
    [sessionsQuery.data]
  );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(max-width: 639px)');
    const update = () => setMobileSwipeEnabled(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!editing) return undefined;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = requestAnimationFrame(() => {
      editDialogRef.current?.querySelector<HTMLElement>('select, input, button')?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      const dialog = editDialogRef.current;
      if (event.key === 'Escape') {
        saveResetRef.current();
        setEditing(null);
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;

      if (
        event.shiftKey &&
        (document.activeElement === first || !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [editing]);

  const selectRange = (nextRange: StudyTimeRange) => {
    setRange(nextRange);
    setAnchorDate(localDateKey(new Date()));
    setSlideDirection(-1);
  };

  const navigatePeriod = (amount: -1 | 1) => {
    if (range === 'all' || analyticsQuery.isFetching || (amount === 1 && !canNavigateLater)) {
      return;
    }
    setSlideDirection(amount);
    setAnchorDate(shiftStudyTimeAnchor(displayedAnchorDate, range, amount));
  };

  const addEntry = () => {
    if (!validEntry) return;
    const startedAt = new Date(entryDate);
    const endedAt = new Date(startedAt.getTime() + minutes * 60000);
    setSessionWindowEnd(new Date(Math.max(Date.now() + 60_000, endedAt.getTime() + 60_000)));
    logCompleted({
      clientSessionId: crypto.randomUUID(),
      category: option.category,
      activity,
      source: 'calendar',
      name: name.trim() || t(option.labelKey),
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      durationMs: minutes * 60000,
    });
  };

  const beginEditing = (session: StudyActivitySession) => {
    saveSession.reset();
    setEditing(session);
    setEditActivity(session.activity);
    setEditName(session.name ?? '');
    setEditDate(localInputValue(new Date(session.startedAt)));
    setEditMinutes(Math.max(1, Math.round(session.durationMs / 60_000)));
  };

  const commitEdit = () => {
    if (!editing) return;
    const selected =
      ACTIVITY_OPTIONS.find((item) => item.activity === editActivity) ?? ACTIVITY_OPTIONS[0];
    const startedAt = new Date(editDate);
    const endedAt = new Date(startedAt.getTime() + editMinutes * 60_000);
    saveSession.mutate(
      {
        ...editing,
        activity: editActivity,
        category: selected.category,
        name: editName.trim() || t(selected.labelKey),
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationMs: editMinutes * 60_000,
        audioPlaybackMs: editActivity === 'daily_audio' ? editMinutes * 60_000 : null,
        cardsCreated: editActivity === 'card_creation' ? editing.cardsCreated : null,
      },
      {
        onSuccess: () => {
          setSessionWindowEnd(new Date(Math.max(Date.now() + 60_000, endedAt.getTime() + 60_000)));
          setEditing(null);
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <header className="retro-paper-panel overflow-hidden p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="retro-caps text-coral">{t('time.eyebrow')}</p>
            <h1 className="retro-headline text-5xl text-navy">{t('time.title')}</h1>
            <p className="mt-2 max-w-2xl text-gray-600">{t('time.description')}</p>
          </div>
          <TrendingUp className="hidden h-14 w-14 text-coral/70 sm:block" aria-hidden="true" />
        </div>
      </header>

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
                key={`${analyticsQuery.data?.anchorDate ?? anchorDate}-${range}`}
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
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="retro-paper-panel space-y-4 p-6">
          <h2 className="retro-headline text-3xl text-navy">{t('time.timer.title')}</h2>
          <select
            value={activity}
            onChange={(event) => setActivity(event.target.value as StudyActivityKind)}
            className="input w-full"
            aria-label={t('time.timer.activityLabel')}
          >
            {ACTIVITY_OPTIONS.map((item) => (
              <option key={item.activity} value={item.activity}>
                {t(item.labelKey)}
              </option>
            ))}
          </select>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="input w-full"
            placeholder={t('time.timer.namePlaceholder')}
            aria-label={t('time.timer.nameLabel')}
          />
          {active ? (
            <button type="button" onClick={() => stop()} className="btn-secondary w-full">
              {t('time.timer.stop', {
                name: active.name || active.activity.replace(/_/g, ' '),
              })}
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                start({
                  category: option.category,
                  activity,
                  source: 'manual',
                  name: name.trim() || t(option.labelKey),
                })
              }
              className="btn-primary flex w-full items-center justify-center gap-2"
            >
              <Play className="h-4 w-4 fill-current" /> {t('time.timer.start')}
            </button>
          )}
        </div>

        <div className="retro-paper-panel space-y-4 p-6">
          <h2 className="retro-headline text-3xl text-navy">{t('time.calendar.title')}</h2>
          <input
            type="datetime-local"
            value={entryDate}
            onChange={(event) => setEntryDate(event.target.value)}
            className="input w-full"
            aria-label={t('time.calendar.dateLabel')}
          />
          <div className="flex gap-3">
            <input
              type="number"
              min={1}
              max={1440}
              value={minutes}
              onChange={(event) => setMinutes(event.target.valueAsNumber)}
              className="input min-w-0 flex-1"
              aria-label={t('time.calendar.durationLabel')}
            />
            <span className="self-center text-gray-600">{t('time.calendar.minutes')}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={addEntry} disabled={!validEntry} className="btn-primary">
              {t('time.calendar.log')}
            </button>
            {validEntry ? (
              <a
                href={googleCalendarUrl(
                  name || t(option.labelKey),
                  new Date(entryDate),
                  minutes,
                  t('time.calendar.defaultName'),
                  t('time.calendar.details')
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline flex items-center justify-center gap-2"
              >
                <CalendarPlus className="h-4 w-4" /> {t('time.calendar.open')}
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="btn-outline flex items-center justify-center gap-2"
              >
                <CalendarPlus className="h-4 w-4" /> {t('time.calendar.open')}
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="retro-paper-panel p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="retro-caps text-coral">{t('time.manual.eyebrow')}</p>
            <h2 className="retro-headline text-3xl text-navy">{t('time.manual.title')}</h2>
          </div>
          <Clock3 className="h-7 w-7 text-coral" aria-hidden="true" />
        </div>
        {sessionsQuery.isLoading ? (
          <p className="mt-4 text-gray-600">{t('time.history.loading')}</p>
        ) : null}
        {sessionsQuery.isError ? (
          <p className="mt-4 text-red-700">{t('time.history.error')}</p>
        ) : null}
        {!sessionsQuery.isLoading && !sessionsQuery.isError && manualSessions.length === 0 ? (
          <p className="mt-4 text-gray-600">{t('time.manual.empty')}</p>
        ) : null}
        <div className="mt-4 divide-y divide-gray-200">
          {manualSessions.map((session) => (
            <div
              key={session.clientSessionId}
              className="flex flex-wrap items-center justify-between gap-4 py-4"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-navy">
                  {session.name || t(`time.activities.${activityTranslationKey(session.activity)}`)}
                </p>
                <p className="text-sm text-gray-500">
                  {new Date(session.startedAt).toLocaleString()} ·{' '}
                  {t(`time.sources.${session.source}`)}
                </p>
                {session.activity === 'card_creation' && session.cardsCreated ? (
                  <p className="text-sm font-bold text-amber-700">
                    {t('time.manual.cards', { count: session.cardsCreated })}
                  </p>
                ) : null}
              </div>
              <p className="font-mono font-bold text-navy">{formatDuration(session.durationMs)}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => beginEditing(session)}
                  className="rounded-lg border border-navy/15 p-2 text-navy hover:bg-navy/5"
                  aria-label={t('time.manual.editAria', {
                    name: session.name || t('time.manual.entryFallback'),
                  })}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteSession.reset();
                    setDeletingSession(session);
                  }}
                  className="rounded-lg border border-red-200 p-2 text-red-700 hover:bg-red-50"
                  aria-label={t('time.manual.deleteAria', {
                    name: session.name || t('time.manual.entryFallback'),
                  })}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {editing ? (
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
        <dialog
          open
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy/45 p-4"
          aria-modal="true"
          aria-labelledby="edit-study-time-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              saveSession.reset();
              setEditing(null);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              saveSession.reset();
              setEditing(null);
            }
          }}
        >
          <div
            ref={editDialogRef}
            className="retro-paper-panel w-full max-w-lg space-y-4 bg-cream p-6 shadow-2xl"
          >
            <h2 id="edit-study-time-title" className="retro-headline text-3xl text-navy">
              {t('time.edit.title')}
            </h2>
            <select
              value={editActivity}
              onChange={(event) => setEditActivity(event.target.value as StudyActivityKind)}
              className="input w-full"
              aria-label={t('time.edit.activityLabel')}
            >
              {ACTIVITY_OPTIONS.map((item) => (
                <option key={item.activity} value={item.activity}>
                  {t(item.labelKey)}
                </option>
              ))}
            </select>
            <input
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
              className="input w-full"
              aria-label={t('time.edit.nameLabel')}
            />
            <input
              type="datetime-local"
              value={editDate}
              onChange={(event) => setEditDate(event.target.value)}
              className="input w-full"
              aria-label={t('time.edit.startLabel')}
            />
            <input
              type="number"
              min={1}
              max={1440}
              value={editMinutes}
              onChange={(event) => setEditMinutes(event.target.valueAsNumber)}
              className="input w-full"
              aria-label={t('time.edit.durationLabel')}
            />
            {saveSession.isError ? (
              <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
                {t('time.edit.error')}
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  saveSession.reset();
                  setEditing(null);
                }}
                className="btn-outline"
              >
                {t('time.edit.cancel')}
              </button>
              <button
                type="button"
                onClick={commitEdit}
                disabled={
                  saveSession.isPending ||
                  !Number.isFinite(editMinutes) ||
                  editMinutes < 1 ||
                  editMinutes > 1440 ||
                  !Number.isFinite(new Date(editDate).getTime())
                }
                className="btn-primary"
              >
                {t('time.edit.save')}
              </button>
            </div>
          </div>
        </dialog>
      ) : null}

      <ConfirmModal
        isOpen={deletingSession !== null}
        title={t('time.delete.title')}
        message={t('time.delete.message', {
          name: deletingSession?.name || t('time.manual.entryFallback'),
        })}
        confirmLabel={t('time.delete.confirm')}
        cancelLabel={t('time.edit.cancel')}
        isLoading={deleteSession.isPending}
        onCancel={() => {
          deleteSession.reset();
          setDeletingSession(null);
        }}
        onConfirm={() => {
          if (!deletingSession) return;
          deleteSession.mutate(deletingSession.clientSessionId, {
            onSuccess: () => setDeletingSession(null),
          });
        }}
      >
        {deleteSession.isError ? (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {t('time.delete.error')}
          </p>
        ) : null}
      </ConfirmModal>
    </div>
  );
};

export default StudyTimePage;
