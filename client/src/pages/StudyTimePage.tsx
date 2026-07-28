import { useMemo, useState } from 'react';
import { addDays, startOfWeek } from 'date-fns';
import { CalendarPlus, Clock3, Headphones, Layers3, Play, Tv, type LucideIcon } from 'lucide-react';

import { useStudyActivityTimer } from '../contexts/StudyActivityContext';
import { useSaveStudyActivitySession, useStudyActivitySessions } from '../hooks/useStudyActivity';
import type {
  StudyActivityCategory,
  StudyActivityKind,
  StudyActivitySession,
} from '../types/studyActivity';
import formatDuration from '../utils/studyTimeFormat';

const ACTIVITY_OPTIONS: Array<{
  activity: StudyActivityKind;
  category: StudyActivityCategory;
  label: string;
}> = [
  { activity: 'card_creation', category: 'create', label: 'Making cards' },
  { activity: 'tv', category: 'immerse', label: 'TV or film' },
  { activity: 'podcast', category: 'immerse', label: 'Podcast' },
  { activity: 'reading', category: 'immerse', label: 'Reading' },
  { activity: 'conversation', category: 'immerse', label: 'Conversation' },
  { activity: 'other', category: 'immerse', label: 'Other study' },
];

function googleCalendarUrl(name: string, start: Date, durationMinutes: number) {
  const end = new Date(start.getTime() + durationMinutes * 60000);
  const compact = (date: Date) =>
    date
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: name || 'Language study',
    dates: `${compact(start)}/${compact(end)}`,
    details: 'Planned with ConvoLab study time.',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

const StudyTimePage = () => {
  const weekStart = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }), []);
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);
  const sessionsQuery = useStudyActivitySessions(weekStart, weekEnd);
  const saveSession = useSaveStudyActivitySession();
  const { active, start, stop } = useStudyActivityTimer();
  const [activity, setActivity] = useState<StudyActivityKind>('card_creation');
  const [name, setName] = useState('');
  const [entryDate, setEntryDate] = useState(() => {
    const local = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  });
  const [minutes, setMinutes] = useState(30);
  const validEntry =
    Number.isFinite(minutes) &&
    minutes >= 1 &&
    minutes <= 1440 &&
    Number.isFinite(new Date(entryDate).getTime());

  const option = ACTIVITY_OPTIONS.find((item) => item.activity === activity) ?? ACTIVITY_OPTIONS[0];
  const sessions = useMemo(() => sessionsQuery.data ?? [], [sessionsQuery.data]);
  const totals = useMemo(
    () =>
      sessions.reduce(
        (result, session) => ({
          ...result,
          [session.category]: result[session.category] + session.durationMs,
        }),
        { review: 0, create: 0, immerse: 0 }
      ),
    [sessions]
  );
  const total = totals.review + totals.create + totals.immerse;

  const addEntry = () => {
    if (!validEntry) return;
    const startedAt = new Date(entryDate);
    const endedAt = new Date(startedAt.getTime() + minutes * 60000);
    const session: StudyActivitySession = {
      clientSessionId: crypto.randomUUID(),
      category: option.category,
      activity,
      source: 'calendar',
      name: name.trim() || option.label,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      durationMs: minutes * 60000,
    };
    saveSession.mutate(session);
  };

  return (
    <div className="space-y-6">
      <header className="retro-paper-panel p-6">
        <p className="retro-caps text-coral">Study time</p>
        <h1 className="retro-headline text-5xl text-navy">Your learning week</h1>
        <p className="mt-2 max-w-2xl text-gray-600">
          One primary activity counts at a time. Audio playback and cards created stay attached to
          that activity without inflating your total.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-4">
        {(
          [
            ['Total', total, Clock3],
            ['Review', totals.review, Layers3],
            ['Create', totals.create, Headphones],
            ['Immerse', totals.immerse, Tv],
          ] as Array<[string, number, LucideIcon]>
        ).map(([label, value, Icon]) => (
          <div key={String(label)} className="retro-paper-panel p-5">
            <Icon className="mb-3 h-6 w-6 text-coral" />
            <p className="retro-caps text-gray-500">{String(label)}</p>
            <p className="text-3xl font-black text-navy">{formatDuration(Number(value))}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="retro-paper-panel space-y-4 p-6">
          <h2 className="retro-headline text-3xl text-navy">Start a timer</h2>
          <select
            value={activity}
            onChange={(event) => setActivity(event.target.value as StudyActivityKind)}
            className="input w-full"
            aria-label="Study activity"
          >
            {ACTIVITY_OPTIONS.map((item) => (
              <option key={item.activity} value={item.activity}>
                {item.label}
              </option>
            ))}
          </select>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="input w-full"
            placeholder="Optional source, show, or project"
            aria-label="Source, show, or project"
          />
          {active ? (
            <button type="button" onClick={() => stop()} className="btn-secondary w-full">
              Stop {active.name || active.activity.replace(/_/g, ' ')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                start({
                  category: option.category,
                  activity,
                  source: 'manual',
                  name: name.trim() || option.label,
                })
              }
              className="btn-primary flex w-full items-center justify-center gap-2"
            >
              <Play className="h-4 w-4 fill-current" /> Start session
            </button>
          )}
        </div>

        <div className="retro-paper-panel space-y-4 p-6">
          <h2 className="retro-headline text-3xl text-navy">Add a calendar entry</h2>
          <input
            type="datetime-local"
            value={entryDate}
            onChange={(event) => setEntryDate(event.target.value)}
            className="input w-full"
            aria-label="Entry start date and time"
          />
          <div className="flex gap-3">
            <input
              type="number"
              min={1}
              max={1440}
              value={minutes}
              onChange={(event) => setMinutes(event.target.valueAsNumber)}
              className="input min-w-0 flex-1"
              aria-label="Duration in minutes"
            />
            <span className="self-center text-gray-600">minutes</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={addEntry}
              disabled={saveSession.isPending || !validEntry}
              className="btn-primary"
            >
              Log entry
            </button>
            {validEntry ? (
              <a
                href={googleCalendarUrl(name || option.label, new Date(entryDate), minutes)}
                target="_blank"
                rel="noreferrer"
                className="btn-outline flex items-center justify-center gap-2"
              >
                <CalendarPlus className="h-4 w-4" /> Google Calendar
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="btn-outline flex items-center justify-center gap-2"
              >
                <CalendarPlus className="h-4 w-4" /> Google Calendar
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="retro-paper-panel p-6">
        <h2 className="retro-headline text-3xl text-navy">This week</h2>
        {sessionsQuery.isLoading ? <p className="mt-4 text-gray-600">Loading study time…</p> : null}
        {sessionsQuery.isError ? (
          <p className="mt-4 text-red-700">Study time couldn’t be loaded. Please try again.</p>
        ) : null}
        {!sessionsQuery.isLoading && !sessionsQuery.isError && sessions.length === 0 ? (
          <p className="mt-4 text-gray-600">Your first completed activity will appear here.</p>
        ) : null}
        <div className="mt-4 divide-y divide-gray-200">
          {[...sessions].reverse().map((session) => (
            <div key={session.clientSessionId} className="flex items-center justify-between py-3">
              <div>
                <p className="font-bold text-navy">
                  {session.name || session.activity.replace(/_/g, ' ')}
                </p>
                <p className="text-sm text-gray-500">
                  {new Date(session.startedAt).toLocaleString()} · {session.source}
                  {session.cardsCreated ? ` · ${session.cardsCreated} cards` : ''}
                </p>
              </div>
              <p className="font-mono font-bold text-navy">{formatDuration(session.durationMs)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default StudyTimePage;
