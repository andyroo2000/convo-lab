import { useEffect, useRef, type RefObject } from 'react';
import { CalendarPlus, ChevronDown, Clock3, Pencil, Play, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import ConfirmModal from '../common/ConfirmModal';
import StudyCapabilitiesError from './StudyCapabilitiesError';
import {
  STUDY_ACTIVITY_OPTIONS,
  studyActivityTranslationKey,
  useStudyTimeSessionManager,
  type StudyTimeSessionManager,
} from '../../hooks/useStudyTimeSessionManager';
import type { StudyActivityKind } from '../../types/studyActivity';
import formatDuration from '../../utils/studyTimeFormat';

interface GoogleCalendarEvent {
  name: string;
  start: Date;
  durationMinutes: number;
  defaultName: string;
  details: string;
}

function googleCalendarUrl(event: GoogleCalendarEvent) {
  const { name, start, durationMinutes, defaultName, details } = event;
  const end = new Date(start.getTime() + durationMinutes * 60_000);
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

const StudyTimerSection = ({ timer }: { timer: StudyTimeSessionManager['timer'] }) => {
  const { t } = useTranslation(['study']);

  return (
    <div className="card app-surface space-y-4 p-4 sm:p-6">
      <h2 className="text-xl font-bold text-navy">{t('time.timer.title')}</h2>
      <select
        value={timer.activity}
        onChange={(event) => timer.setActivity(event.target.value as StudyActivityKind)}
        className="app-form-control w-full"
        aria-label={t('time.timer.activityLabel')}
      >
        {STUDY_ACTIVITY_OPTIONS.map((item) => (
          <option key={item.activity} value={item.activity}>
            {t(item.labelKey)}
          </option>
        ))}
      </select>
      <input
        value={timer.name}
        onChange={(event) => timer.setName(event.target.value)}
        className="app-form-control w-full"
        placeholder={t('time.timer.namePlaceholder')}
        aria-label={t('time.timer.nameLabel')}
      />
      {timer.active ? (
        <button type="button" onClick={timer.stop} className="app-button-secondary w-full">
          {t('time.timer.stop', {
            name: timer.active.name || timer.active.activity.replace(/_/g, ' '),
          })}
        </button>
      ) : (
        <button
          type="button"
          onClick={timer.start}
          disabled={!timer.isReady}
          className="app-button-primary flex w-full items-center justify-center gap-2"
        >
          <Play className="h-4 w-4 fill-current" /> {t('time.timer.start')}
        </button>
      )}
    </div>
  );
};

const StudyCalendarSection = ({ calendar }: { calendar: StudyTimeSessionManager['calendar'] }) => {
  const { t } = useTranslation(['study']);

  return (
    <div className="card app-surface space-y-4 p-4 sm:p-6">
      <h2 className="text-xl font-bold text-navy">{t('time.calendar.title')}</h2>
      <input
        type="datetime-local"
        value={calendar.entryDate}
        onChange={(event) => calendar.setEntryDate(event.target.value)}
        className="app-form-control w-full"
        aria-label={t('time.calendar.dateLabel')}
      />
      <div className="flex gap-3">
        <input
          type="number"
          min={1}
          max={1440}
          value={calendar.minutes}
          onChange={(event) => calendar.setMinutes(event.target.valueAsNumber)}
          className="app-form-control min-w-0 flex-1"
          aria-label={t('time.calendar.durationLabel')}
        />
        <span className="self-center text-gray-600">{t('time.calendar.minutes')}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={calendar.addEntry}
          disabled={!calendar.isValid}
          className="app-button-primary"
        >
          {t('time.calendar.log')}
        </button>
        {calendar.isValid ? (
          <a
            href={googleCalendarUrl({
              name: calendar.name || t(calendar.selectedOption.labelKey),
              start: new Date(calendar.entryDate),
              durationMinutes: calendar.minutes,
              defaultName: t('time.calendar.defaultName'),
              details: t('time.calendar.details'),
            })}
            target="_blank"
            rel="noopener noreferrer"
            className="app-button-secondary flex items-center justify-center gap-2"
          >
            <CalendarPlus className="h-4 w-4" /> {t('time.calendar.open')}
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="app-button-secondary flex items-center justify-center gap-2"
          >
            <CalendarPlus className="h-4 w-4" /> {t('time.calendar.open')}
          </button>
        )}
      </div>
    </div>
  );
};

type StudySession = StudyTimeSessionManager['history']['sessions'][number];

const ManualSessionRow = ({
  session,
  history,
}: {
  session: StudySession;
  history: StudyTimeSessionManager['history'];
}) => {
  const { t } = useTranslation(['study']);
  const displayName =
    session.name || t(`time.activities.${studyActivityTranslationKey(session.activity)}`);
  const entryName = session.name || t('time.manual.entryFallback');

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 py-4">
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-navy">{displayName}</p>
        <p className="text-sm text-gray-500">
          {new Date(session.startedAt).toLocaleString()} · {t(`time.sources.${session.source}`)}
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
          onClick={() => history.beginEditing(session)}
          className="rounded-lg border border-navy/15 p-2 text-navy hover:bg-navy/5"
          aria-label={t('time.manual.editAria', { name: entryName })}
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => history.beginDeleting(session)}
          className="rounded-lg border border-red-200 p-2 text-red-700 hover:bg-red-50"
          aria-label={t('time.manual.deleteAria', { name: entryName })}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

const ManualSessionsStatus = ({ history }: { history: StudyTimeSessionManager['history'] }) => {
  const { t } = useTranslation(['study']);
  if (history.isLoading) {
    return <p className="mt-4 text-gray-600">{t('time.history.loading')}</p>;
  }
  if (history.isError) {
    return <p className="mt-4 text-red-700">{t('time.history.error')}</p>;
  }
  if (history.sessions.length === 0) {
    return <p className="mt-4 text-gray-600">{t('time.manual.empty')}</p>;
  }
  return null;
};

const LoadMoreSessionsButton = ({ history }: { history: StudyTimeSessionManager['history'] }) => {
  const { t } = useTranslation(['study']);
  if (!history.hasNextPage) return null;

  return (
    <button
      type="button"
      className="app-button-secondary mt-4 w-full"
      onClick={() => history.loadMore()}
      disabled={history.isFetchingNextPage}
    >
      {history.isFetchingNextPage ? t('time.manual.loadingMore') : t('time.manual.loadMore')}
    </button>
  );
};

const StudyManualSessionsSection = ({
  history,
}: {
  history: StudyTimeSessionManager['history'];
}) => {
  const { t } = useTranslation(['study']);

  return (
    <section className="card app-surface p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {t('time.manual.eyebrow')}
          </p>
          <h2 className="text-xl font-bold text-navy">{t('time.manual.title')}</h2>
        </div>
        <Clock3 className="h-7 w-7 text-coral" aria-hidden="true" />
      </div>
      <ManualSessionsStatus history={history} />
      <div className="mt-4 divide-y divide-gray-200">
        {history.sessions.map((session) => (
          <ManualSessionRow key={session.clientSessionId} session={session} history={history} />
        ))}
      </div>
      <LoadMoreSessionsButton history={history} />
    </section>
  );
};

const dialogFocusableElements = (dialog: HTMLDivElement) =>
  Array.from(
    dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  );

const backwardTabDestination = (
  event: KeyboardEvent,
  dialog: HTMLDivElement,
  first: HTMLElement,
  last: HTMLElement
) => {
  if (!event.shiftKey) return null;
  if (document.activeElement === first) return last;
  if (!dialog.contains(document.activeElement)) return last;
  return null;
};

const forwardTabDestination = (event: KeyboardEvent, first: HTMLElement, last: HTMLElement) => {
  if (event.shiftKey) return null;
  return document.activeElement === last ? first : null;
};

const trapDialogTabKey = (event: KeyboardEvent, dialog: HTMLDivElement | null) => {
  if (event.key !== 'Tab' || !dialog) return;
  const focusable = dialogFocusableElements(dialog);
  const first = focusable[0];
  const last = focusable.at(-1);
  if (!first || !last) return;

  const destination =
    backwardTabDestination(event, dialog, first, last) ?? forwardTabDestination(event, first, last);
  if (!destination) return;
  event.preventDefault();
  destination.focus();
};

const StudyTimeEditForm = ({
  edit,
  dialogRef,
}: {
  edit: StudyTimeSessionManager['edit'];
  dialogRef: RefObject<HTMLDivElement>;
}) => {
  const { t } = useTranslation(['study']);
  return (
    <div ref={dialogRef} className="app-surface w-full max-w-lg space-y-4 bg-white p-6 shadow-2xl">
      <h2 id="edit-study-time-title" className="text-2xl font-bold text-navy">
        {t('time.edit.title')}
      </h2>
      <select
        value={edit.activity}
        onChange={(event) => edit.setActivity(event.target.value as StudyActivityKind)}
        className="app-form-control w-full"
        aria-label={t('time.edit.activityLabel')}
      >
        {STUDY_ACTIVITY_OPTIONS.map((item) => (
          <option key={item.activity} value={item.activity}>
            {t(item.labelKey)}
          </option>
        ))}
      </select>
      <input
        value={edit.name}
        onChange={(event) => edit.setName(event.target.value)}
        className="app-form-control w-full"
        aria-label={t('time.edit.nameLabel')}
      />
      <input
        type="datetime-local"
        value={edit.date}
        onChange={(event) => edit.setDate(event.target.value)}
        className="app-form-control w-full"
        aria-label={t('time.edit.startLabel')}
      />
      <input
        type="number"
        min={1}
        max={1440}
        value={edit.minutes}
        onChange={(event) => edit.setMinutes(event.target.valueAsNumber)}
        className="app-form-control w-full"
        aria-label={t('time.edit.durationLabel')}
      />
      {edit.isError ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {t('time.edit.error')}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={edit.cancel} className="app-button-secondary">
          {t('time.edit.cancel')}
        </button>
        <button
          type="button"
          onClick={edit.save}
          disabled={edit.isPending || !edit.isValid}
          className="app-button-primary"
        >
          {t('time.edit.save')}
        </button>
      </div>
    </div>
  );
};

const StudyTimeEditDialog = ({ edit }: { edit: StudyTimeSessionManager['edit'] }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef(edit.cancel);
  cancelRef.current = edit.cancel;

  useEffect(() => {
    if (!edit.session) return undefined;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>('select, input, button')?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        cancelRef.current();
        return;
      }
      trapDialogTabKey(event, dialogRef.current);
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [edit.session]);

  if (!edit.session) return null;

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <dialog
      open
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/45 p-4"
      aria-modal="true"
      aria-labelledby="edit-study-time-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) edit.cancel();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') edit.cancel();
      }}
    >
      <StudyTimeEditForm edit={edit} dialogRef={dialogRef} />
    </dialog>
  );
};

const StudyTimeDeleteModal = ({ deletion }: { deletion: StudyTimeSessionManager['deletion'] }) => {
  const { t } = useTranslation(['study']);

  return (
    <ConfirmModal
      isOpen={deletion.session !== null}
      title={t('time.delete.title')}
      message={t('time.delete.message', {
        name: deletion.session?.name || t('time.manual.entryFallback'),
      })}
      confirmLabel={t('time.delete.confirm')}
      cancelLabel={t('time.edit.cancel')}
      isLoading={deletion.isPending}
      onCancel={deletion.cancel}
      onConfirm={deletion.confirm}
    >
      {deletion.isError ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {t('time.delete.error')}
        </p>
      ) : null}
    </ConfirmModal>
  );
};

const StudyTimeSessionSections = () => {
  const { t } = useTranslation(['study']);
  const manager = useStudyTimeSessionManager();

  return (
    <>
      <StudyCapabilitiesError
        isError={manager.capabilities.isError}
        isRetrying={manager.capabilities.isRetrying}
        onRetry={() => {
          manager.capabilities.retry().catch(() => undefined);
        }}
      />
      <section
        className="card app-surface overflow-hidden"
        aria-labelledby="manual-study-time-title"
      >
        <details className="group" data-testid="manual-study-time-section">
          <summary className="flex cursor-pointer list-none items-start gap-3 p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-navy sm:p-6">
            <ChevronDown
              className="mt-1 h-5 w-5 shrink-0 text-coral transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
            <Clock3 className="h-7 w-7 shrink-0 text-coral" aria-hidden="true" />
            <div className="min-w-0">
              <h2 id="manual-study-time-title" className="text-xl font-bold text-navy sm:text-2xl">
                {t('time.manual.sectionTitle')}
              </h2>
              <p className="mt-1 max-w-2xl text-sm font-semibold text-gray-500">
                {t('time.manual.sectionDescription')}
              </p>
            </div>
          </summary>

          <div className="space-y-6 border-t border-gray-200 p-4 sm:p-6">
            <section className="grid gap-6 lg:grid-cols-2">
              <StudyTimerSection timer={manager.timer} />
              <StudyCalendarSection calendar={manager.calendar} />
            </section>
            <StudyManualSessionsSection history={manager.history} />
          </div>
        </details>
      </section>
      <StudyTimeEditDialog edit={manager.edit} />
      <StudyTimeDeleteModal deletion={manager.deletion} />
    </>
  );
};

export default StudyTimeSessionSections;
