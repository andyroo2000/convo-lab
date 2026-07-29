import { useMemo, useState } from 'react';
import { CalendarPlus, Clock3, Pencil, Play, Trash2, TrendingUp } from 'lucide-react';
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

function bucketLabel(date: Date, range: StudyTimeRange) {
  if (range === 'today') return date.toLocaleTimeString([], { hour: 'numeric' });
  if (range === 'week') return date.toLocaleDateString([], { weekday: 'short' });
  if (range === 'month') return date.toLocaleDateString([], { day: 'numeric' });
  if (range === 'year') return date.toLocaleDateString([], { month: 'short' });
  return date.toLocaleDateString([], { year: 'numeric' });
}

function activityTranslationKey(activity: StudyActivityKind) {
  if (activity === 'card_review') return 'cardReview';
  if (activity === 'daily_audio') return 'dailyAudio';
  if (activity === 'card_creation') return 'cardCreation';
  if (activity === 'wanikani_review') return 'wanikaniReview';
  return activity;
}

const StudyRhythmChart = ({ analytics }: { analytics: StudyTimeAnalyticsRange }) => {
  const { t } = useTranslation(['study']);
  const maximum = Math.max(...analytics.buckets.map((bucket) => bucket.totalMs), 1);
  const best = analytics.buckets.reduce<StudyTimeAnalyticsBucket | null>(
    (winner, bucket) => (!winner || bucket.totalMs > winner.totalMs ? bucket : winner),
    null
  );
  const elapsedDays = Math.max(
    1,
    Math.ceil(
      (Math.min(Date.now(), new Date(analytics.endsAt).getTime()) -
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
            {best ? bucketLabel(new Date(best.startsAt), analytics.key) : '—'}
          </p>
          <p className="text-sm font-bold text-gray-500">
            {best ? formatDuration(best.totalMs) : formatDuration(0)}
          </p>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto pb-2">
        <div
          className="grid h-64 items-end gap-2 border-b-2 border-navy/20 px-2"
          style={{
            gridTemplateColumns: `repeat(${Math.max(analytics.buckets.length, 1)}, 1fr)`,
            minWidth: `${Math.max(analytics.buckets.length * 54, 280)}px`,
          }}
          aria-label={t('time.analytics.chartLabel')}
        >
          {analytics.buckets.map((bucket) => (
            <div key={bucket.startsAt} className="flex h-full min-w-0 flex-col justify-end">
              <div
                className="flex min-h-0 w-full flex-col-reverse overflow-hidden rounded-t-md shadow-sm"
                style={{
                  height: `${Math.max(2, (bucket.totalMs / maximum) * 88)}%`,
                }}
                title={`${bucketLabel(new Date(bucket.startsAt), analytics.key)}: ${formatDuration(
                  bucket.totalMs
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
                    />
                  );
                })}
              </div>
              <p className="mt-2 truncate text-center text-[11px] font-bold text-gray-500">
                {bucketLabel(new Date(bucket.startsAt), analytics.key)}
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
  const { t } = useTranslation(['study']);
  const now = useMemo(() => new Date(Date.now() + 60_000), []);
  const rollingStart = useMemo(() => new Date(now.getTime() - 93 * 86_400_000), [now]);
  const sessionsQuery = useStudyActivitySessions(rollingStart, now);
  const analyticsQuery = useStudyActivityAnalytics();
  const saveSession = useSaveStudyActivitySession();
  const deleteSession = useDeleteStudyActivitySession();
  const { active } = useStudyActivityStatus();
  const { start, stop, logCompleted } = useStudyActivityActions();
  const [range, setRange] = useState<StudyTimeRange>('week');
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
  const validEntry =
    Number.isFinite(minutes) &&
    minutes >= 1 &&
    minutes <= 1440 &&
    Number.isFinite(new Date(entryDate).getTime());

  const option = ACTIVITY_OPTIONS.find((item) => item.activity === activity) ?? ACTIVITY_OPTIONS[0];
  const analytics = analyticsQuery.data?.ranges.find((item) => item.key === range);
  const manualSessions = useMemo(
    () =>
      [...(sessionsQuery.data ?? [])]
        .filter((session) => session.source !== 'automatic')
        .sort((left, right) => right.startedAt.localeCompare(left.startedAt)),
    [sessionsQuery.data]
  );

  const addEntry = () => {
    if (!validEntry) return;
    const startedAt = new Date(entryDate);
    const endedAt = new Date(startedAt.getTime() + minutes * 60000);
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
    saveSession.mutate(
      {
        ...editing,
        activity: editActivity,
        category: selected.category,
        name: editName.trim() || t(selected.labelKey),
        startedAt: startedAt.toISOString(),
        endedAt: new Date(startedAt.getTime() + editMinutes * 60_000).toISOString(),
        durationMs: editMinutes * 60_000,
        audioPlaybackMs: editActivity === 'daily_audio' ? editMinutes * 60_000 : null,
      },
      { onSuccess: () => setEditing(null) }
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
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="retro-caps text-coral">{t('time.analytics.eyebrow')}</p>
            <h2 className="retro-headline text-3xl text-navy">{t('time.title')}</h2>
          </div>
          <div
            className="grid grid-cols-5 rounded-xl border-2 border-navy/10 bg-white/70 p-1"
            role="radiogroup"
            aria-label={t('time.analytics.timeSpan')}
          >
            {RANGES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setRange(item)}
                className={`rounded-lg px-2.5 py-2 text-xs font-black uppercase tracking-wide transition sm:px-4 ${
                  range === item ? 'bg-navy text-white shadow-sm' : 'text-gray-500 hover:text-navy'
                }`}
                role="radio"
                aria-checked={range === item}
              >
                {t(`time.analytics.ranges.${item}`)}
              </button>
            ))}
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
        {analytics ? <StudyRhythmChart analytics={analytics} /> : null}
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
                  onClick={() => setDeletingSession(session)}
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-study-time-title"
        >
          <div className="retro-paper-panel w-full max-w-lg space-y-4 bg-cream p-6 shadow-2xl">
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
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setEditing(null)} className="btn-outline">
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
        </div>
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
        onCancel={() => setDeletingSession(null)}
        onConfirm={() => {
          if (!deletingSession) return;
          deleteSession.mutate(deletingSession.clientSessionId, {
            onSuccess: () => setDeletingSession(null),
          });
        }}
      />
    </div>
  );
};

export default StudyTimePage;
