import { AlertTriangle, CalendarSearch, Check, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { GoogleCalendarPreview } from '../../hooks/useGoogleCalendarConnection';
import formatDuration from '../../utils/studyTimeFormat';

interface GoogleCalendarEventPreviewProps {
  preview: GoogleCalendarPreview | undefined;
  isLoading: boolean;
  isError: boolean;
  disabled: boolean;
  onPreview: () => void;
}

function dateTime(value: string, locale: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

const GoogleCalendarEventPreview = ({
  preview,
  isLoading,
  isError,
  disabled,
  onPreview,
}: GoogleCalendarEventPreviewProps) => {
  const { t, i18n } = useTranslation(['study']);
  const tp = (key: string, values?: Record<string, unknown>) =>
    t(`time.calendarConnection.preview.${key}`, values);
  const locale = i18n.resolvedLanguage ?? i18n.language;
  let actionLabel = tp('action');
  if (isLoading) actionLabel = tp('loading');
  else if (preview || isError) actionLabel = tp('refresh');
  const matchKeyCounts = new Map<string, number>();
  const keyedMatches =
    preview?.matches.map((match) => {
      const signature = [match.calendarId, match.startsAt, match.endsAt, match.title].join('\0');
      const occurrence = matchKeyCounts.get(signature) ?? 0;
      matchKeyCounts.set(signature, occurrence + 1);
      return { key: `${signature}\0${occurrence}`, match };
    }) ?? [];

  return (
    <section aria-labelledby="calendar-preview-title" className="mt-7 border-t border-navy/10 pt-6">
      <p className="retro-caps text-coral">{tp('eyebrow')}</p>
      <h3 id="calendar-preview-title" className="mt-1 text-xl font-black text-navy">
        {tp('title')}
      </h3>
      <p className="mt-2 text-sm text-gray-600">{tp('description')}</p>
      <button
        type="button"
        className="btn-outline mt-4 min-h-11 w-full justify-center disabled:opacity-50"
        onClick={onPreview}
        disabled={disabled || isLoading}
      >
        {isLoading ? (
          <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <CalendarSearch className="h-4 w-4" aria-hidden="true" />
        )}
        {actionLabel}
      </button>

      {isLoading ? (
        <p role="status" className="mt-4 text-center text-sm text-gray-600">
          {tp('loadingStatus')}
        </p>
      ) : null}
      {isError ? (
        <div className="mt-4 rounded-xl bg-red-50 p-4">
          <p role="alert" className="text-sm text-red-800">
            {tp('error')}
          </p>
          <button
            type="button"
            className="btn-outline mt-3 min-h-11 disabled:opacity-50"
            onClick={onPreview}
            disabled={disabled || isLoading}
          >
            {tp('retry')}
          </button>
        </div>
      ) : null}
      {preview ? (
        <div className="mt-4" aria-live="polite">
          <p className="rounded-xl bg-blue-50 p-3 text-sm text-navy">
            {tp('range', {
              start: dateTime(preview.startsAt, locale),
              end: dateTime(preview.endsAt, locale),
            })}
          </p>
          {preview.truncated ? (
            <p className="mt-3 flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {tp('truncated', { shown: preview.matches.length, total: preview.matchedEventCount })}
            </p>
          ) : null}
          {preview.matches.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-navy/20 bg-white/60 p-5 text-center">
              <p className="font-bold text-navy">{tp('emptyTitle')}</p>
              <p className="mt-1 text-sm text-gray-600">{tp('emptyBody')}</p>
            </div>
          ) : (
            <ul className="mt-3 space-y-3" aria-label={tp('matchesLabel')}>
              {keyedMatches.map(({ key, match }) => (
                <li key={key} className="rounded-2xl border border-navy/10 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words font-black text-navy">{match.title}</p>
                      <p className="mt-1 break-words text-sm text-gray-600">{match.calendarName}</p>
                    </div>
                    {match.alreadySynced ? (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-800">
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        {tp('imported')}
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600">
                        {tp('notImported')}
                      </span>
                    )}
                  </div>
                  <p
                    className="mt-3 text-sm font-bold text-navy"
                    aria-label={tp('eventTime', {
                      start: dateTime(match.startsAt, locale),
                      end: dateTime(match.endsAt, locale),
                      duration: formatDuration(match.durationMs),
                    })}
                  >
                    <time dateTime={match.startsAt}>{dateTime(match.startsAt, locale)}</time>
                    {' – '}
                    <time dateTime={match.endsAt}>{dateTime(match.endsAt, locale)}</time>
                    {' · '}
                    {formatDuration(match.durationMs)}
                  </p>
                  <p className="mt-2 text-xs text-gray-600">
                    {tp('matchedTerms', { terms: match.matchedTerms.join(', ') })}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-gray-500">
            {tp('counts', {
              matched: preview.matchedEventCount,
              scanned: preview.scannedEventCount,
            })}
          </p>
        </div>
      ) : null}
    </section>
  );
};

export default GoogleCalendarEventPreview;
