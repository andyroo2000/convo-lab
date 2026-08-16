import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, RefreshCw, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  useGoogleCalendars,
  useSaveGoogleCalendarSettings,
} from '../../hooks/useGoogleCalendarConnection';
import {
  GOOGLE_CALENDAR_SETTINGS_LIMITS,
  type GoogleCalendarSettings,
} from '../../utils/googleCalendarSettings';

interface GoogleCalendarSettingsDialogProps {
  settings: GoogleCalendarSettings | null;
  refreshSettings: () => Promise<GoogleCalendarSettings | null>;
  onClose: () => void;
}
const GoogleCalendarSettingsDialog = ({
  settings,
  refreshSettings,
  onClose,
}: GoogleCalendarSettingsDialogProps) => {
  const { t } = useTranslation(['study']);
  const tc = (key: string) => t(`time.calendarConnection.${key}`);
  const limit = GOOGLE_CALENDAR_SETTINGS_LIMITS.calendars;
  const calendars = useGoogleCalendars();
  const save = useSaveGoogleCalendarSettings();
  const [selectedIds, setSelectedIds] = useState(() => settings?.calendarIds ?? []);
  const baseIds = useRef(settings?.calendarIds ?? []).current;
  const [refreshError, setRefreshError] = useState(false);
  const [limitError, setLimitError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isBusy = save.isPending || isRefreshing;
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closedRef = useRef(false);
  const close = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    onCloseRef.current();
  }, []);
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key !== 'Tab') return;
      const targets = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled)'
        ) ?? []
      );
      const [first] = targets;
      const last = targets.at(-1);
      const boundary = event.shiftKey ? first : last;
      if (document.activeElement !== boundary) return;
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus();
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleEscape);
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleEscape);
      previouslyFocused?.focus();
    };
  }, [close]);
  const toggleCalendar = (calendarId: string) => {
    setSelectedIds((current) =>
      current.includes(calendarId)
        ? current.filter((selectedId) => selectedId !== calendarId)
        : [...current, calendarId].slice(0, limit)
    );
  };
  const submit = async () => {
    if (!settings || selectedIds.length === 0) return;
    setRefreshError(false);
    setLimitError(false);
    setIsRefreshing(true);
    try {
      const freshSettings = await refreshSettings();
      if (closedRef.current) return;
      if (!freshSettings) throw new Error('Settings unavailable');
      const removed = new Set(baseIds.filter((id) => !selectedIds.includes(id)));
      const added = selectedIds.filter((id) => !baseIds.includes(id));
      const calendarIds = freshSettings.calendarIds
        .filter((id) => !removed.has(id))
        .concat(added.filter((id) => !freshSettings.calendarIds.includes(id)));
      if (calendarIds.length > limit) {
        setLimitError(true);
        return;
      }
      await save.mutateAsync({ ...freshSettings, calendarIds });
      if (!closedRef.current) close();
    } catch {
      if (!closedRef.current) setRefreshError(true);
    } finally {
      if (!closedRef.current) setIsRefreshing(false);
    }
  };
  const listedIds = new Set(calendars.data?.calendars.map((calendar) => calendar.id));
  const missingIds = calendars.isSuccess ? selectedIds.filter((id) => !listedIds.has(id)) : [];
  const selectionLimitReached = selectedIds.length >= limit;
  const saveDisabled =
    !settings || !selectedIds.length || calendars.isLoading || calendars.isError || isBusy;
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end bg-navy/55 p-0 sm:items-center sm:justify-center sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      role="presentation"
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-settings-title"
        aria-describedby="calendar-settings-description"
        className="flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-cream shadow-2xl sm:max-w-xl sm:rounded-3xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-navy/10 p-5 sm:p-6">
          <div>
            <p className="retro-caps text-coral">{tc('settingsEyebrow')}</p>
            <h2 id="calendar-settings-title" className="retro-headline text-3xl text-navy">
              {tc('settingsTitle')}
            </h2>
            <p id="calendar-settings-description" className="mt-2 text-sm text-gray-600">
              {tc('settingsDescription')}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={close}
            aria-label={tc('closeSettings')}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-navy/15 bg-white text-navy transition hover:bg-blue-50 disabled:opacity-50"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-44 flex-1 overflow-y-auto p-5 sm:p-6">
          {!settings ? (
            <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">
              {tc('settingsUnavailable')}
            </p>
          ) : null}
          {calendars.isLoading ? (
            <div role="status" className="flex justify-center gap-3 py-14 text-gray-600">
              <RefreshCw className="h-5 w-5 animate-spin" aria-hidden="true" />
              {tc('calendarsLoading')}
            </div>
          ) : null}
          {calendars.isError ? (
            <div className="space-y-4 rounded-xl bg-red-50 p-4">
              <p role="alert" className="text-sm text-red-800">
                {tc('calendarsError')}
              </p>
              <button type="button" className="btn-outline" onClick={() => calendars.refetch()}>
                {tc('retry')}
              </button>
            </div>
          ) : null}
          {calendars.isSuccess && calendars.data.calendars.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-navy/20 bg-white/60 p-6 text-center">
              <CalendarDays className="mx-auto h-8 w-8 text-blue-600" aria-hidden="true" />
              <p className="mt-3 font-bold text-navy">{tc('calendarsEmptyTitle')}</p>
              <p className="mt-1 text-sm text-gray-600">{tc('calendarsEmptyBody')}</p>
              <button
                type="button"
                className="btn-outline mt-4"
                onClick={() => calendars.refetch()}
              >
                {tc('retry')}
              </button>
            </div>
          ) : null}
          {calendars.isSuccess && calendars.data.calendars.length > 0 ? (
            <fieldset>
              <legend className="retro-caps text-gray-500">{tc('calendarListLabel')}</legend>
              <div className="mt-3 space-y-3">
                {calendars.data.calendars.map((calendar, index) => (
                  <label
                    key={calendar.id}
                    htmlFor={`google-calendar-option-${index}`}
                    className="flex min-h-14 cursor-pointer items-center gap-4 rounded-2xl border border-navy/10 bg-white px-4 py-3 transition hover:border-blue-300 hover:bg-blue-50 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50"
                  >
                    <input
                      id={`google-calendar-option-${index}`}
                      type="checkbox"
                      checked={selectedIds.includes(calendar.id)}
                      disabled={
                        isBusy || (selectionLimitReached && !selectedIds.includes(calendar.id))
                      }
                      onChange={() => toggleCalendar(calendar.id)}
                      className="h-5 w-5 shrink-0 accent-blue-600"
                    />
                    <span className="min-w-0 flex-1 font-bold text-navy">
                      {calendar.name || tc('untitledCalendar')}
                    </span>
                    {calendar.primary ? (
                      <span className="rounded-full bg-navy px-2.5 py-1 text-xs font-bold text-white">
                        {tc('primaryCalendar')}
                      </span>
                    ) : null}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          {missingIds.length > 0 ? (
            <div className="mt-4 space-y-3">
              <p className="retro-caps text-gray-500">{tc('unavailableCalendarsLabel')}</p>
              {missingIds.map((calendarId, index) => (
                <label
                  key={calendarId}
                  htmlFor={`unavailable-google-calendar-${index}`}
                  className="flex min-h-14 cursor-pointer items-center gap-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3"
                >
                  <input
                    id={`unavailable-google-calendar-${index}`}
                    type="checkbox"
                    checked
                    disabled={isBusy}
                    onChange={() => toggleCalendar(calendarId)}
                    className="h-5 w-5 shrink-0 accent-blue-600"
                  />
                  <span className="min-w-0 flex-1 break-all font-bold text-navy">{calendarId}</span>
                  <span className="text-xs">{tc('unavailableCalendar')}</span>
                </label>
              ))}
            </div>
          ) : null}
          {calendars.data?.truncated ? (
            <p className="mt-4 text-sm text-gray-600">{tc('calendarsTruncated')}</p>
          ) : null}
          {selectionLimitReached || limitError ? (
            <p role="status" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              {t('time.calendarConnection.calendarLimit', { count: limit })}
            </p>
          ) : null}
          {settings && selectedIds.length === 0 ? (
            <p
              id="calendar-selection-error"
              role="alert"
              className="mt-4 text-sm font-bold text-red-700"
            >
              {tc('calendarRequired')}
            </p>
          ) : null}
          {save.isError || refreshError ? (
            <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">
              {tc('saveError')}
            </p>
          ) : null}
        </div>
        <footer className="grid grid-cols-2 gap-3 border-t border-navy/10 bg-white/60 p-5 sm:p-6">
          <button type="button" className="btn-outline min-h-11" onClick={close}>
            {t('time.edit.cancel')}
          </button>
          <button
            type="button"
            className="btn-primary min-h-11 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={submit}
            disabled={saveDisabled}
            aria-describedby={
              settings && !selectedIds.length ? 'calendar-selection-error' : undefined
            }
          >
            {isBusy ? tc('savingCalendars') : tc('saveCalendars')}
          </button>
        </footer>
      </section>
    </div>,
    document.body
  );
};
export default GoogleCalendarSettingsDialog;
