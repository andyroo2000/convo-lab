import { useEffect, useRef } from 'react';
import { CalendarPlus, Clock3, Pencil, Play, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import ConfirmModal from '../common/ConfirmModal';
import {
  STUDY_ACTIVITY_OPTIONS,
  studyActivityTranslationKey,
  useStudyTimeSessionManager,
  type StudyTimeSessionManager,
} from '../../hooks/useStudyTimeSessionManager';
import type { StudyActivityKind } from '../../types/studyActivity';
import formatDuration from '../../utils/studyTimeFormat';

function googleCalendarUrl(
  name: string,
  start: Date,
  durationMinutes: number,
  defaultName: string,
  details: string
) {
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
    <div className="retro-paper-panel space-y-4 p-6">
      <h2 className="retro-headline text-3xl text-navy">{t('time.timer.title')}</h2>
      <select
        value={timer.activity}
        onChange={(event) => timer.setActivity(event.target.value as StudyActivityKind)}
        className="input w-full"
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
        className="input w-full"
        placeholder={t('time.timer.namePlaceholder')}
        aria-label={t('time.timer.nameLabel')}
      />
      {timer.active ? (
        <button type="button" onClick={timer.stop} className="btn-secondary w-full">
          {t('time.timer.stop', {
            name: timer.active.name || timer.active.activity.replace(/_/g, ' '),
          })}
        </button>
      ) : (
        <button
          type="button"
          onClick={timer.start}
          className="btn-primary flex w-full items-center justify-center gap-2"
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
    <div className="retro-paper-panel space-y-4 p-6">
      <h2 className="retro-headline text-3xl text-navy">{t('time.calendar.title')}</h2>
      <input
        type="datetime-local"
        value={calendar.entryDate}
        onChange={(event) => calendar.setEntryDate(event.target.value)}
        className="input w-full"
        aria-label={t('time.calendar.dateLabel')}
      />
      <div className="flex gap-3">
        <input
          type="number"
          min={1}
          max={1440}
          value={calendar.minutes}
          onChange={(event) => calendar.setMinutes(event.target.valueAsNumber)}
          className="input min-w-0 flex-1"
          aria-label={t('time.calendar.durationLabel')}
        />
        <span className="self-center text-gray-600">{t('time.calendar.minutes')}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={calendar.addEntry}
          disabled={!calendar.isValid}
          className="btn-primary"
        >
          {t('time.calendar.log')}
        </button>
        {calendar.isValid ? (
          <a
            href={googleCalendarUrl(
              calendar.name || t(calendar.selectedOption.labelKey),
              new Date(calendar.entryDate),
              calendar.minutes,
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
  );
};

const StudyManualSessionsSection = ({
  history,
}: {
  history: StudyTimeSessionManager['history'];
}) => {
  const { t } = useTranslation(['study']);

  return (
    <section className="retro-paper-panel p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="retro-caps text-coral">{t('time.manual.eyebrow')}</p>
          <h2 className="retro-headline text-3xl text-navy">{t('time.manual.title')}</h2>
        </div>
        <Clock3 className="h-7 w-7 text-coral" aria-hidden="true" />
      </div>
      {history.isLoading ? <p className="mt-4 text-gray-600">{t('time.history.loading')}</p> : null}
      {history.isError ? <p className="mt-4 text-red-700">{t('time.history.error')}</p> : null}
      {!history.isLoading && !history.isError && history.sessions.length === 0 ? (
        <p className="mt-4 text-gray-600">{t('time.manual.empty')}</p>
      ) : null}
      <div className="mt-4 divide-y divide-gray-200">
        {history.sessions.map((session) => (
          <div
            key={session.clientSessionId}
            className="flex flex-wrap items-center justify-between gap-4 py-4"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-navy">
                {session.name ||
                  t(`time.activities.${studyActivityTranslationKey(session.activity)}`)}
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
                onClick={() => history.beginEditing(session)}
                className="rounded-lg border border-navy/15 p-2 text-navy hover:bg-navy/5"
                aria-label={t('time.manual.editAria', {
                  name: session.name || t('time.manual.entryFallback'),
                })}
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => history.beginDeleting(session)}
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
  );
};

const StudyTimeEditDialog = ({ edit }: { edit: StudyTimeSessionManager['edit'] }) => {
  const { t } = useTranslation(['study']);
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
      const dialog = dialogRef.current;
      if (event.key === 'Escape') {
        cancelRef.current();
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
      <div
        ref={dialogRef}
        className="retro-paper-panel w-full max-w-lg space-y-4 bg-cream p-6 shadow-2xl"
      >
        <h2 id="edit-study-time-title" className="retro-headline text-3xl text-navy">
          {t('time.edit.title')}
        </h2>
        <select
          value={edit.activity}
          onChange={(event) => edit.setActivity(event.target.value as StudyActivityKind)}
          className="input w-full"
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
          className="input w-full"
          aria-label={t('time.edit.nameLabel')}
        />
        <input
          type="datetime-local"
          value={edit.date}
          onChange={(event) => edit.setDate(event.target.value)}
          className="input w-full"
          aria-label={t('time.edit.startLabel')}
        />
        <input
          type="number"
          min={1}
          max={1440}
          value={edit.minutes}
          onChange={(event) => edit.setMinutes(event.target.valueAsNumber)}
          className="input w-full"
          aria-label={t('time.edit.durationLabel')}
        />
        {edit.isError ? (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {t('time.edit.error')}
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={edit.cancel} className="btn-outline">
            {t('time.edit.cancel')}
          </button>
          <button
            type="button"
            onClick={edit.save}
            disabled={edit.isPending || !edit.isValid}
            className="btn-primary"
          >
            {t('time.edit.save')}
          </button>
        </div>
      </div>
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
  const manager = useStudyTimeSessionManager();

  return (
    <>
      <section className="grid gap-6 lg:grid-cols-2">
        <StudyTimerSection timer={manager.timer} />
        <StudyCalendarSection calendar={manager.calendar} />
      </section>
      <StudyManualSessionsSection history={manager.history} />
      <StudyTimeEditDialog edit={manager.edit} />
      <StudyTimeDeleteModal deletion={manager.deletion} />
    </>
  );
};

export default StudyTimeSessionSections;
